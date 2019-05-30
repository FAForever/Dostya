
const fakeGuild = {name: 'BAN-MANAGER', id: '0003'};

const fs = require('fs');
const EventEmitter = require('events');
const status = new EventEmitter();
const sqlite3 = require('sqlite3').verbose();
const utils = require('./utility.js');

const ACTIONS = {
    NOTIFY : -1,
    WARN : 0,
    KICK : 1,
    BAN : 2,
    UNBAN: 3,
}

let isInitialized = false;

async function initialize(guilds){
    utils.log("Starting guilds databases initialization...", "--", fakeGuild);
    const guildList = guilds.array();
    for (let k in guildList){
        const guild = guildList[k];
        const db = await initializeGuildDatabase(guild);
    }
    utils.log("Guilds database initialization finished", "--", fakeGuild);
    isInitialized = true;
}

async function takeAction(ACTION, guild, target, author, str="", revokeAt){
    if (!isInitialized) return false;
    const db = await getGuildDatabase(guild);
    let notification;
    if (str.length > 0){
        notification = "**"+translateAction(ACTION)+"** :\n"+str; 
    }
    else{
        notification = "You've received a **"+translateAction(ACTION)+"** from the moderation team for one of your recent actions. Be sure to check and re-read the rules if you're unsure of what behavior to follow in a community."
    }
    
    if (ACTION === ACTIONS.BAN && revokeAt){
        const date = new Date(revokeAt*1000).toLocaleString();
        notification += "\nThis action will revoke at **"+date+"**";
    }
    // If the target is a guildmember
    if (target.guild){
        await target.user.send(notification);
    }
    else{
        target = {"id":target};
    }
    
    const sqlStr = str.replace("\\'","''");
    
    switch (ACTION){
        case ACTIONS.WARN:
            await logModeratorAction(db, target.id, author.id, sqlStr, ACTION);
            break;
            
        case ACTIONS.KICK:
            await logModeratorAction(db, target.id, author.id, sqlStr, ACTION);
            target.kick(notification);
            break;
            
        case ACTIONS.BAN:
            target.ban(notification);
            const modActionId = await logModeratorAction(db, target.id, author.id, sqlStr, ACTION);
            db.run("INSERT INTO bans (moderator_action_id, target_id, unban_at) VALUES ('"+modActionId+"', '"+target.id+"', "+revokeAt+")");
            break;
            
        case ACTIONS.UNBAN:
            const bans = await guild.fetchBans();
            if (utils.isNumeric(target.id)){
                db.run("DELETE FROM bans WHERE target_id="+target.id+"");
            }
            if (bans.has(target.id)){
                await logModeratorAction(db, target.id, author.id, sqlStr, ACTION);
                guild.unban(target.id, str);
            }
            else{
                const errMsg = "User #"+target.id+" cannot be unbanned, because they are not banned.";
                utils.log(errMsg, "WW", fakeGuild);
                status.emit(ACTIONS.NOTIFY, author, errMsg);
                return; // Invalid use
            }
            break;
    }
    
    status.emit(ACTION, target, author, str, revokeAt);
}

async function logModeratorAction(db, targetId, issuerId, reason, action){
    return await utils.dbRunAsync(db, "INSERT INTO moderator_actions (target_id, issuer_id, reason, action) VALUES ('"+targetId+"','"+issuerId+"','"+reason+"','"+action+"')");
}

async function updateBans(guilds){
    if (!isInitialized) return false;
    const guildList = guilds.array();
    utils.log("Updating the bans of "+guildList.length+" guilds", "++", fakeGuild);
    for (let k in guildList){
        const guild = guildList[k];
        const db = await getGuildDatabase(guild);
        db.each("SELECT id,target_id,unban_at FROM bans", async function(err, row){
            if (err){
                utils.log("Error while fetching a ban", "WW", fakeGuild);
                console.log(err);
                return;
            }
            const revokeAt = row['unban_at'];
            const targetId = row['target_id'];
            if (revokeAt == null || revokeAt == undefined){
                utils.log(guild.name+": No revocation time given for ban #"+row['id'], '++', fakeGuild);
                return;
            }
            utils.log(guild.name+": Ban time left for #"+targetId+": "+Math.round((revokeAt - Date.now()/1000))+"s", '++', fakeGuild);
            if ((revokeAt - Date.now()/1000)< 0){ // Time to automatically unban the user
                const bans = await guild.fetchBans();
                if (bans.has(targetId)){
                    utils.log("Unbanning user #"+targetId+" (clock ran out)", "!!", fakeGuild);
                    takeAction(ACTIONS.UNBAN, guild, targetId, guild.me, "Ban expired");
                }
            }
        });
    }
}

async function getUserInfo(guild, discordId, callback){
    if (!isInitialized) return false;
    
    const db = await getGuildDatabase(guild);
    let message = "User info for <@"+discordId+"> "+discordId+": \n\n";
    fetchUser(discordId, db, async function(rows){
        for (k in rows){
            const row = rows[k];
            const issuer = await guild.members.get(row['issuer_id']);
            let issuerName = "<unknown>";
            if (issuer){
                issuerName = issuer.user.username;
            }
            let line = "**"+translateAction(row['action'])+"** by `"+issuerName+"` at "+row['create_time']+". Reason : "+row["reason"]+".";
            if (row['action'] == ACTIONS.BAN){
                const banRecord = await utils.dbFetchAsync(db, "SELECT unban_at FROM bans WHERE moderator_action_id='"+row["id"]+"'").catch(function(e){console.log(e);});
                if (banRecord != undefined){
                    line += "\nWill be revoked at : "+banRecord['unban_at'];
                }
            }
            line += "\n\n";
            
            if (message.length + line.length > 1999){
                callback(message);
                message = '';
            }
            message += line;
        }
        callback(message);
    });
}

function fetchUser(discordId, db, callback){
    db.all("SELECT * FROM moderator_actions WHERE target_id="+discordId, function(err, rows){
        if (err){
            utils.log('Ban manager encountered an error while fetching an user. Follows :', 'WW', fakeGuild);
            console.log(err);
        }
        else{
            callback(rows);
        }
    });
}

function translateAction(ACTION){
    switch (ACTION){
        case ACTIONS.WARN:
            return "WARNING";
            break;
            
        case ACTIONS.KICK:
            return "KICK";
            break;
            
        case ACTIONS.BAN:
            return "BAN";
            break;
            
        case ACTIONS.UNBAN:
            return "PARDON";
            break;
    }
    
}

async function initializeGuildDatabase(guild){
    const migrationPath = process.cwd()+"/configuration/guild_database_setup/";
    const files = fs.readdirSync(migrationPath);
    let db = await getGuildDatabase(guild);
    for (k in files){
        const file = files[k];
        if (file.substr(file.length - 4) != ".sql"){
            continue;
        }
        utils.log("Running DB script ["+file+"]", 'DD', guild);
        let data = await utils.readFileAsync(migrationPath+file);
        let queries = data.split(";");
        for(line in queries){
            const query = queries[line];
            if (query.replace(/(\r\n|\n|\r)/gm,"").length <= 0){ continue; }
            await utils.dbRunAsync(db, query).catch(function(e){});
        }
    }
    utils.log("Initialized the guild database for "+guild.name+"", 'DD', fakeGuild);
}

async function getGuildDatabase(guild){
    const path = process.cwd()+'/_private/identities/'+guild.id+'/moderator_actions.db';
    let db;
    return new sqlite3.Database(path);
}


module.exports = {
    takeAction:
    function(ACTION, guild, target, author, str, revokeAt){
        return takeAction(ACTION, guild, target, author, str, revokeAt);
    },
    getUserInfo:
    function(guild, discordId, callback){
        return getUserInfo(guild, discordId, callback);
    },
    status:status,
    ACTIONS:ACTIONS,
    updateBans:
    function(guilds){
        return updateBans(guilds);
    },
    initialize:
    async function(guilds){
        return await initialize(guilds);
    }
}