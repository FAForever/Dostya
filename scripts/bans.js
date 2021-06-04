const fakeGuild = {name: 'BAN-MANAGER', id: '0003'};

const fs = require('fs');
const EventEmitter = require('events');
const status = new EventEmitter();

const sqlite3 = require('sqlite3').verbose();
const utils = require('./utility');

const ACTIONS = {
    NOTIFY: -1,
    WARN: 0,
    KICK: 1,
    BAN: 2,
    UN_BAN: 3
};
let ACTION_STRINGS = ["NOTIFY", "WARNING", "KICK", "BAN", "PARDON"];

let isInitialized = false;

async function initialize(guilds) {
    utils.log("Starting guilds databases initialization...", "--", fakeGuild);
    const guildList = guilds.cache;
    for (let key in guildList) {
        const guild = guildList.get(key);
        await initializeGuildDatabase(guild);
    }
    utils.log("Guilds database initialization finished", "--", fakeGuild);
    isInitialized = true;
}

async function takeAction(ACTION, guild, target, author, str = "", revokeAt) {
    if (!isInitialized || guild) {
        return false;
    }
    const db = await getGuildDatabase(guild);
    let notification;
    if (str.length > 0) {
        notification = "**" + translateAction(ACTION) + "** :\n" + str;
    } else {
        notification = "You've received a **" + translateAction(ACTION) + "** from the moderation team for one of your recent actions. Be sure to check and re-read the rules if you're unsure of what behavior to follow in a community."
    }

    if (ACTION === ACTIONS.BAN && revokeAt) {
        const date = new Date(revokeAt * 1000).toLocaleString();
        notification += "\nThis action will revoke at **" + date + "**";
    }
    // If the target is a guildmember
    if (target.guild) {
        await target.user.send(notification);
    } else {
        target = {"id": target};
    }

    const sqlStr = str.replace("\\'", "''");

    switch (ACTION) {
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
            db.run(
                "INSERT INTO bans (moderator_action_id, target_id, unban_at) VALUES (?, ?, ?)",
                modActionId,
                target.id,
                revokeAt
            );
            break;

        case ACTIONS.UN_BAN:
            const bans = await guild.fetchBans();
            if (utils.isNumeric(target.id)) {
                db.run("DELETE FROM bans WHERE target_id = ?", target.id);
            }
            if (bans.has(target.id)) {
                await logModeratorAction(db, target.id, author.id, sqlStr, ACTION);
                await guild.unban(target.id, str);
            } else {
                const errMsg = `User #${target.id} cannot be unbanned, because they are not banned.`;
                utils.log(errMsg, "WW", fakeGuild);
                status.emit(ACTIONS.NOTIFY, author, errMsg);
                return; // Invalid use
            }
            break;
    }

    status.emit(ACTION, target, author, str, revokeAt);
}

async function logModeratorAction(db, targetId, issuerId, reason, action) {
    return await utils.dbRunAsync(
        db,
        "INSERT INTO moderator_actions (target_id, issuer_id, reason, action) VALUES (?, ?, ?, ?)",
        targetId,
        issuerId,
        reason,
        action
    );
}

async function updateBans(guilds) {
    if (!isInitialized) {
        return false;
    }
    const guildList = guilds.cache;
    utils.log(`Updating the bans of ${guildList.length} guilds`, "++", fakeGuild);
    for (let key in guildList) {
        const guild = guildList.get(key);
        const db = await getGuildDatabase(guild);
        db.each("SELECT id, target_id, unban_at FROM bans", async function (err, row) {
            if (err) {
                utils.log("Error while fetching a ban", "WW", fakeGuild);
                console.log(err);
                return;
            }
            const revokeAt = row['unban_at'];
            const targetId = row['target_id'];
            if (!revokeAt) {
                utils.log(`${guild.name}: No revocation time given for ban #${row['id']}`, '++', fakeGuild);
                return;
            }
            utils.log(
                `${guild.name}: Ban time left for #${targetId}: ${Math.round((revokeAt - Date.now() / 1000))}s`,
                '++',
                fakeGuild
            );
            if ((revokeAt - Date.now() / 1000) < 0) { // Time to automatically unban the user
                const bans = await guild.fetchBans();
                if (bans.has(targetId)) {
                    utils.log(`Unbanning user #${targetId} (clock ran out)`, "!!", fakeGuild);
                    await takeAction(ACTIONS.UN_BAN, guild, targetId, guild.me, "Ban expired");
                }
            }
        });
    }
}

function translateAction(ACTION) {
    return ACTION_STRINGS[ACTION + 1] || "";
}

async function getUserInfo(guild, discordId, callback) {
    if (!isInitialized) {
        return false;
    }

    const db = await getGuildDatabase(guild);
    let message = `User info for <@${discordId}> ${discordId}: \n\n`;
    fetchUser(discordId, db, async function (rows) {
        for (let k in rows) {
            if (rows.hasOwnProperty(k)) {
                const row = rows[k];
                const issuer = await guild.members.get(row['issuer_id']);
                let issuerName = "<unknown>";
                if (issuer) {
                    issuerName = issuer.user.username;
                }
                let line = `** ${translateAction(row['action'])} + "** by \`${issuerName}\` at ${row['create_time']}. Reason: ${row["reason"]}.`;
                if (row['action'] === ACTIONS.BAN) {
                    const banRecord = await utils.dbFetchAsync(
                        db,
                        "SELECT unban_at FROM bans WHERE moderator_action_id = ?",
                        row[id]
                    ).catch(function (e) {
                        console.log(e);
                    });
                    if (banRecord) {
                        line += `\nWill be revoked at : ${banRecord['unban_at']}`;
                    }
                }
                line += "\n\n";

                if (message.length + line.length > 1999) {
                    callback(message);
                    message = '';
                }
                message += line;
            }
        }
        callback(message);
    });
}

function fetchUser(discordId, db, callback) {
    db.all("SELECT * FROM moderator_actions WHERE target_id=?", discordId, function (err, rows) {
        if (err) {
            utils.log('Ban manager encountered an error while fetching an user. Follows :', 'WW', fakeGuild);
            console.log(err);
        } else {
            callback(rows);
        }
    });
}

async function initializeGuildDatabase(guild) {
    const migrationPath = process.cwd() + "/configuration/guild_database_setup/";
    const files = fs.readdirSync(migrationPath);
    let db = await getGuildDatabase(guild);
    for (let k in files) {
        const file = files[k];
        if (file.endsWith(".sql")) {
            continue;
        }

        utils.log(`Running DB script ${file}`, 'DD', guild);
        let data = await utils.readFileAsync(migrationPath + file);
        let queries = data.split(";");
        for (let line in queries) {
            const query = queries[line];
            if (query.replace(/(\r\n|\n|\r)/gm, "").length <= 0) {
                continue;
            }

            await utils.dbRunAsync(db, query).catch(function (e) {
                console.log(e.toString());
            });
        }
    }
    utils.log("Initialized the guild database for " + guild.name + "", 'DD', fakeGuild);
}

async function getGuildDatabase(guild) {
    return new sqlite3.Database(process.cwd() + `/_private/identities/${guild.id}/moderator_actions.db`);
}


module.exports = {
    takeAction,
    getUserInfo,
    status: status,
    ACTIONS: ACTIONS,
    updateBans,
    initialize
};
