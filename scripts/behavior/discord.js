const Discord = require("discord.js");
const fs = require("fs");
const fetch = require("node-fetch");

const linker = require("../faf_account_linking");
const utils = require("../utility");
const user = require("./user");
const db = require("../db").db;

let lastAnimatedMessage = {};


/**
 * Creates a new role in the specifics and on the discord server
 * Won't check if the role is present
 * @param {String} roleName The name of the role to create
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role creation succeeded and completes exceptionally when the creation failed due to the discord server
 */
async function createRole(roleName, message) {
    let specifics = utils.getSpecifics(message.guild);
    specifics["registeredRoles"].push(roleName);
    utils.writeSpecifics(message.guild, specifics);
    try {
        await message.guild.createRole({
            name: roleName,
            color: "LIGHT_GREY",
            mentionable: true,
            hoist: false
        }, "Created by Dostya as requested by" + message.author.username);
        utils.log(`Created role ${roleName} as requested by discord user ${message.author.id}`, "--", message.guild);
    } catch (e) {
        let specificsCreateRoleFailed = utils.getSpecifics(message.guild);
        specificsCreateRoleFailed.registeredRoles = specificsCreateRoleFailed.registeredRoles.filter(role => role !== roleName);
        utils.writeSpecifics(message.guild, specificsCreateRoleFailed);
        utils.log("Error while creating role. Reason: " + e, "WW", message.guild);
        await sendMessage(message.channel, "Could not create role `" + roleName + "` due to internal discord error. Please contact an administrator. Error: " + e);
        return;
    }

    await sendMessage(message.channel, "Role `" + roleName + "` created");
}

/**
 * Deletes a role in the specifics and on the discord server
 * Won't check if the role is present
 * @param {String} roleName The name of the role to delete
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role deletion succeeded and completes exceptionally when the deletion failed due to the discord server
 */
async function deleteRole(roleName, message) {
    let specifics = utils.getSpecifics(message.guild);
    specifics.registeredRoles = specifics.registeredRoles.filter(role => role !== roleName);
    utils.writeSpecifics(message.guild, specifics);

    let roleToDelete = Array.from(message.guild.roles.values()).find(role => role.name === roleName);
    if (roleToDelete !== undefined) {
        try {
            await roleToDelete.delete();
        } catch (e) {
            utils.log(`Role ${roleName} unregistered. Could not delete the discord role. (failed due to discord error ` + e + `)`);
            await sendMessage(message.channel, "Role `" + roleName + "` was unregistered from Dostya. I could not delete the discord role - Maybe permissions are missing? Please remove the discord role manually. (Error: " + e + ")");
            return;
        }
        utils.log(`Role ${roleName} deleted.`, "--", message.guild);
        await sendMessage(message.channel, "Role `" + roleName + "` deleted");
    } else {
        utils.log(`Role ${roleName} unregistered. Could not delete the discord role. (not found)`, "WW", message.guild);
        await sendMessage(message.channel, "Role `" + roleName + "` was unregistered from Dostya. Discord role could not be deleted - Maybe permissions are missing?\nPlease remove the discord role `" + roleName + "` manually.")
    }
}

/**
 * Subscribe to a role (assign discord role)
 * Won't check if the role is present (If called without checking beforehand this can assign potentially hazardous roles like administrator to users )
 * @param {String} roleName The name of the role
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role (un)subscription and completes exceptionally when the (un)subscription failed due to the discord server
 */
async function subscribe(roleName, message) {
    let roleToSubscribe = Array.from(message.guild.roles.values()).find(role => role.name === roleName);

    if (roleToSubscribe !== undefined) {
        let guildMember = await message.guild.fetchMember(message.author);
        await guildMember.addRole(roleToSubscribe);
        utils.log(`Added member ${message.author.id} to role ${roleName}.`, "--", message.guild);
        await message.react("✅");
        setTimeout(function () {
            message.clearReactions();
        }, 3000);
    } else {
        utils.log(`Failed adding member ${message.author.id} to role ${roleName}. (role not found on discord server)`, "WW", message.guild);
        await sendMessage(message.channel, "Role `" + roleName + "` is absent from the discord server. Please ask a moderator for help. (Dostya knows this role, but the discord server does not)");
    }
}

/**
 * Unsubscribe from a role (remove discord role)
 * Won't check if the role is present (If called without checking beforehand this can assign potentially hazardous roles like administrator to users )
 * @param {String} roleName The name of the role
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role (un)subscription and completes exceptionally when the (un)subscription failed due to the discord server
 */
async function unsubscribe(roleName, message) {
    let roleToUnsubscribe = Array.from(message.guild.roles.values()).find(role => role.name === roleName);

    if (roleToUnsubscribe !== undefined) {
        let guildMember = await message.guild.fetchMember(message.author);
        await guildMember.removeRole(roleToUnsubscribe);
        utils.log(`Removed member ${message.author.id} from role ${roleName}.`, "--", message.guild);
        await message.react("✅");
        setTimeout(function () {
            message.clearReactions();
        }, 3000);
    } else {
        utils.log(`Failed removing member ${message.author.id} from role ${roleName}. (role not found)`, "WW", message.guild);
        await sendMessage(message.channel, "Role not present on discord server.");
    }
}

/// Send the tracker file to the users on demand
function sendTrackerFile(author, guild) {
    const trackerFile = utils.getTrackerFile(guild);
    if (fs.existsSync(trackerFile)) {
        utils.log("Sent trackerfile to " + author.username + "", "<<");
        return author.send({files: [new Discord.Attachment(trackerFile)]});
    } else {
        utils.log("No trackerfile to send to " + author.username + "", "<<");
        return sendMessage(author, "Trackerfile is empty or does not exist.");
    }
}

/// PMS welcome message to the user
function sendWelcomeMessageTo(guildMember) {
    guildMember.send("Hello and Welcome to the **FAF Discord Server**. We are quite active and are happy to help with any problems you may have. \n\n__**Useful Links**__\nForums: http://forums.faforever.com/index.php \nWiki: https://wiki.faforever.com/index.php?title=Main_Page \nClient Download: https://faforever.com/client")
        .catch(e => {
            utils.log("Could not send welcome message to " + guildMember.user.username + "");
        });
}

/// Sends message to the channel
function sendMessage(channel, msgContent) {
    let canSend = true;

    if (channel instanceof Discord.Channel) {
        const myPermissions = channel.permissionsFor(channel.guild.me);
        canSend = myPermissions.has('SEND_MESSAGES');
    }

    if (canSend) {
        utils.log("SendDiscordMessage ________________", "DD");
        utils.log("Sent message " + msgContent + " on " + channel.name, "DD", channel.guild);
        utils.log("________________", "DD");
        return channel.send(msgContent);
    }
    return utils.emptyPromise();
}

/// Sends records on this channel
function sendRecords(channel, settings) {
    let message = '```';
    const specs = utils.getSpecifics(channel.guild);
    for (let k in specs["recorded-messages"]) {
        const cmd = settings["prefixes"][0] + k;
        const content = specs["recorded-messages"][k];

        const line = cmd + " => " + content + "\n\n";

        if (message.length + line.length >= 2000) {
            sendMessage(channel, message + "```");
            message = '```';
        }
        message += line;
    }
    sendMessage(channel, message + "```");
}

/// Display link table in a channel with ASCII character
async function sendLinktable(channel, settings) {
    return db.all('SELECT * FROM account_links ORDER BY create_time', async function (err, rows) {
        if (err) {
            utils.log("Error fetching rows for account linking", "WW", channel.guild);
            console.log(err);
            return;
        }
        let message = '```FAF:ID => Discord:ID```';
        for (let k in rows) {
            const response = await fetch(settings.urls.data + 'player?filter=id==' + rows[k].faf_id + '&fields[player]=login');
            const json = await response.json();
            const playerName = json.data[0].attributes.login;
            let userName;
            const getMember = await channel.guild.members.get(rows[k].discord_id)
            try {
                userName = getMember.user.tag;
            } catch (e) {
                // User is probably banned or left from this discord
                userName = '<unknown>';
            } finally {
                const line = "```" + playerName + ":" + rows[k].faf_id + " => " + userName + ":" + rows[k].discord_id + "```";
                if (message.length + line.length >= 2000) {
                    sendMessage(channel, message);
                    message = '';
                }
                message += line;
            }
        }
        sendMessage(channel, message);
    });
}


/// Breaks link between discord user and faf user, and logs in moderator room of the guild
function unlink(discordTagOrFafId, guild, callback) {
    let fafId = "-1";
    let discordId = "-1";

    // FAF ID
    if (utils.isNumeric(discordTagOrFafId)) {
        fafId = discordTagOrFafId;
    }

    // Discord ping
    else if (discordTagOrFafId.substr(0, 1) === "<") {
        discordId = utils.getIdFromString(discordTagOrFafId);
        let stop = false;
        ifLinked(discordId, function (isLinked) {
            if (!isLinked) {
                stop = true;
            }
        });
        if (stop) {
            callback(false);
            return;
        }
    }

    // Command misuse
    else {
        callback(false);
        return;
    }

    db.run("DELETE FROM account_links WHERE faf_id=? OR discord_id=?", fafId, discordId, callback);
    logForModerators(guild, "Account unlinked (" + fafId + "<>" + discordId + ")");
}


/// PMs the restriction list to the user
function sendRestrictions(author, guild) {
    let specs = utils.getSpecifics(guild);
    return sendMessage(author, "Current restrictions : `" + specs.restricted.join('`, `') + "`");
}

/// PMs the blacklist to the user
function sendBlacklist(author, guild) {
    let specs = utils.getSpecifics(guild);
    return sendMessage(author, "Current blacklist : " + specs.blacklist.join(','));
}


/// Adds user to the blacklist
function blacklistUser(author, userId, guild) {
    let specs = utils.getSpecifics(guild);
    if (!user.isBlacklistedUser(userId, guild)) {
        specs.blacklist.push(userId);
        utils.log("Added " + userId + " to the blacklist");
    }
    utils.writeSpecifics(guild, specs);
    return sendBlacklist(author, guild);
}


/// Reacts with a little W A I T on the last command that couldn't be fired because of cooldown
function animateCooldown(message) {
    if (lastAnimatedMessage.react != undefined) {
        lastAnimatedMessage.clearReactions();
    }
    message.react("🇼")
        .then(() => message.react("🇦"))
        .then(() => message.react("🇮"))
        .then(() => message.react("🇹"));
    lastAnimatedMessage = message;
}

/// Replies to existing message
function replyToMessage(message, msgContent) {
    const myPermissions = message.channel.permissionsFor(message.guild.me);
    if (myPermissions.has('SEND_MESSAGES')) {
        utils.log("Sent as a reply message " + msgContent + " on " + message.toString() + "", "DD", message.guild);
        return message.reply(msgContent);
    }
    return utils.emptyPromise();
}


function logForModerators(guild, message) {
    let specifics = utils.getSpecifics(guild);
    if (guild.channels.exists("id", specifics['moderator-log-channel'])) {
        const modLog = guild.channels.find("id", specifics['moderator-log-channel']);
        sendMessage(modLog, message);
    } else {
        specifics['moderator-log-channel'] = null;
        utils.writeSpecifics(guild, specifics);
    }
}

function linkUser(discordId, fafId) {
    db.run("INSERT INTO account_links (faf_id, discord_id) VALUES (?, ?)", fafId, discordId);
}

function link(message, username) {
    ifLinked(message.author.id, function (isLinked) {
        if (!isLinked) {
            linker.start(message.author.id)
                .then(function (address) {
                    sendMessage(message.author, "You have requested to link account with faf account `" + username + "`. To proceed, please open the address " + address + " in your browser and log-in.\nYou have **30 SECONDS** before the link expires.");
                    linker.status.on("success", function (login, fafId, discordId) {
                        if (discordId === message.author.id) {
                            if (login === username) {
                                linkUser(discordId, fafId);
                                const logMessage = "`" + login + ":" + fafId + "` has been linked to discord user `" + message.author.tag + ":" + discordId + "`";
                                sendMessage(message.author, "The FAF user `" + login + "` has successfully been linked with your discord account. :slight_smile:");
                                utils.log(logMessage, '--', message.guild);

                                // Notice the moderation channel
                                logForModerators(message.guild, logMessage);
                            } else {
                                sendMessage(message.author, "The FAF username `" + login + "` is different from the username provided (`" + username + "`). No link could be established.");
                            }
                            sendMessage(message.author, "You can now safely close your log-in browser tab.");
                        }
                    });
                    linker.status.on("expired", function (discordId) {
                        if (discordId === message.author.id) {
                            sendMessage(message.author, "The link has expired");
                        }
                    });
                });
        } else {
            sendMessage(message.author, "Your discord account is already linked to a FAF account.");
        }
    });
}

function ifLinked(discord_id, callback) {
    db.get("SELECT faf_id FROM account_links WHERE discord_id=?", discord_id, function (err, row) {
        callback(!err && row !== undefined);
    });
}

/// Restricts a command on this guild - only mods will be able to use it
function restrictCommand(author, str_command, guild) {
    let specs = utils.getSpecifics(guild);
    if (!isRestrictedCommand(str_command, guild)) {
        specs.restricted.push(str_command);
    }
    utils.writeSpecifics(guild, specs);
    return sendRestrictions(author, guild);
}


/// Deletes a restriction
function unrestrictCommand(author, str_command, guild) {
    let specs = utils.getSpecifics(guild);
    if (isRestrictedCommand(str_command, guild)) {
        const index = specs.restricted.indexOf(str_command);
        specs.restricted.splice(index, 1);
    }
    utils.writeSpecifics(guild, specs);
    return sendRestrictions(author, guild);
}

/// Replace aliases in commands
function aliasCommand(message, settings) {
    if (settings.aliases) {
        const grabs = Object.keys(settings.aliases);
        let msgString = message.content;

        for (let i = 0; i < grabs.length; i++) {	//Check if message includes one of the aliases
            const thisAlias = grabs[i];
            let validAlias = true;

            for (let j = 0; j < thisAlias.length; j++) {
                let thisChar = msgString.charAt(j);
                let thisPrefChar = thisAlias.charAt(j);
                validAlias = thisChar === thisPrefChar;
            }
            if (validAlias) {
                message.content = settings.aliases[thisAlias] + message.content.substring(thisAlias.length);
            }
        }
    }
}

module.exports = {
    sendWelcomeMessageTo,
    sendMessage,
    ifLinked,
    createRole,
    deleteRole,
    subscribe,
    unsubscribe,
    sendTrackerFile,
    sendRecords,
    sendLinktable,
    unlink,
    sendRestrictions,
    sendBlacklist,
    blacklistUser,
    animateCooldown,
    replyToMessage,
    logForModerators,
    link,
    restrictCommand,
    unrestrictCommand,
    aliasCommand,
};
