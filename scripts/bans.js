
const fakeGuild = {name: 'BAN-MANAGER', id: '0003'};

const fs = require('fs');
const EventEmitter = require('events');
const status = new EventEmitter();
const sqlite3 = require('sqlite3').verbose();
const utils = require('./utility.js');

const ACTIONS = {
    WARN : 0,
    KICK : 1,
    BAN : 2,
    UNBAN: 3,
}

function initialize(guilds){
    const guildList = guilds.array();
    for (let k in guildList){
        const guild = guildList[k];
        const db = getGuildDatabase(guild);
    }
}

async function takeAction(ACTION, guild, target, author, str="", revokeAt){
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
            break;
            
        case ACTIONS.KICK:
            target.kick(notification);
            break;
            
        case ACTIONS.BAN:
            target.ban(notification);
            db.run("INSERT INTO bans (target_id, issuer_id, reason, unban_at) VALUES ('"+target.id+"', '"+author.id+"', '"+sqlStr+"', "+revokeAt+")");
            break;
            
        case ACTIONS.UNBAN:
            const bans = await guild.fetchBans();
            if (bans.has(target.id)){
                guild.unban(target.id, str);
            }
            else{
                return; // Invalid use
            }
            break;
    }
    
    status.emit(ACTION, target, author, str, revokeAt);
    db.run("INSERT INTO moderator_actions (target_id, issuer_id, reason, action) VALUES ('"+target.id+"', '"+author.id+"', '"+sqlStr+"', "+ACTION+")");
}

async function updateBans(guilds){
    const guildList = guilds.array();
    utils.log("Updating the bans of "+guildList.length+" guilds", "DD", fakeGuild);
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
                utils.log(guild.name+": No revocation time given for ban #"+row['id'], 'DD', fakeGuild);
                return;
            }
            utils.log(guild.name+": Ban time left for #"+row['id']+": "+revokeAt+" - "+(Date.now()/1000)+" = "+(revokeAt - Date.now()/1000)+"s", 'DD', fakeGuild);
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
            let line = "**"+translateAction(row['action'])+"** by `"+issuerName+"` at "+Date(row['create_time']*1000).toLocaleString()+". Reason : "+row["reason"]+".";
            if (row['action'] == ACTIONS.BAN){
                line += "\nWill be revoked at : "+Date(row['unban_at']*1000).toLocaleString();
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

async function getGuildDatabase(guild){
    const path = process.cwd()+'/_private/identities/'+guild.id+'/moderator_actions.db';
    let db;
    try{
        let test = await utils.fileExists(path);
        db = new sqlite3.Database(path);
    }
    catch(e){
        const migrationPath = process.cwd()+"/configuration/guild_database_setup/";
        const files = fs.readdirSync(migrationPath);
        db = new sqlite3.Database(path);
        for (k in files){
            const file = files[k];
            if (file.substr(file.length - 4) != ".sql"){
                continue;
            }
            utils.log("Running initialization script ["+file+"]", 'DD', fakeGuild);
            let data = await utils.readFileAsync(migrationPath+file);
            await utils.dbRunAsync(db, data);
        }
        utils.log("Initialized the bans database for "+guild.name+" (first time)", '--', fakeGuild);
    }
    finally{
        return db;
    }
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
    function(guilds){
        return initialize(guilds);
    }
}