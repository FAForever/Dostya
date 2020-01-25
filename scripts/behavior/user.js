const utils = require("../utility");


/**
 * Checks wether a role is already present
 * @param {String} roleName The role to check
 * @param {Guild} guild The guild to investigate
 * @returns {boolean} Wether this role is already present in the guild specifics
 */
function roleExists(roleName, guild) {
    let specifics = utils.getSpecifics(guild);
    return specifics["registeredRoles"].some(role => role === roleName)
}

/// Checks if the function is only for developers
function isDeveloperCommand(command, settings) {
    const devCmds = settings['dev-only-commands'];
    if (devCmds.indexOf(command) > -1) {
        return true;
    }
    return false;
}

/// Checks if the user is a moderator on this guild
function isDeveloper(author, settings) {
    const devs = settings.devs;
    if (devs.indexOf(author.id + "") > -1) {
        return true;
    }
    return false;
}

/// Removes user from the blacklist
function unblacklistUser(author, userId, guild) {
    let specs = utils.getSpecifics(guild);
    if (isBlacklistedUser(userId, guild)) {
        const index = specs.blacklist.indexOf(userId);
        specs.blacklist.splice(index, 1);
        utils.log("Removed " + userId + " from the blacklist");
    }
    utils.writeSpecifics(guild, specs);
    return sendBlacklist(author, guild);
}

/// Checks if the user is blacklisted on this guild
function isBlacklistedUser(userId, guild) {
    const specs = utils.getSpecifics(guild);
    for (let i = 0; i < specs.blacklist.length; i++) {
        const thisBlacklistId = specs.blacklist[i];
        if (thisBlacklistId === userId) {
            return true;
        }
    }
    return false;
}

/// Checks if the user is a moderator on this guild
function isModerator(member, guild) {
    const specs = utils.getSpecifics(guild);

    for (let i = 0; i < specs.mods.length; i++) {
        const thisModId = specs.mods[i];

        for (let property of member.roles) {
            const role = property;

            if (thisModId.search('<@&' + role[0] + '>') > -1) {
                return true;
            }
        }
    }
    return false;
}


/// Defines a Specifics settings
function defineSpecific(message, property, type, data) {
    let specifics = utils.getSpecifics(message.guild);
    switch (type) {
        case "array":
            specifics[property] = data.split(',');
            break;
    }
    utils.writeSpecifics(message.guild, specifics);
    return sendMessage(message.author, "`" + message.guild.id + '.' + property + ' set to ' + data + '`');
}

/// Searches for a player and returns result as a block message
function fetchPlayerList(searchTerm, limit, apiUrl, callback) {

    utils.httpFetch(apiUrl + 'player?filter=login=="' + searchTerm + '*"&page[limit]=' + (limit + 1) + '', function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }

        const data = JSON.parse(d);
        if (data.data != undefined && data.data.length > 0) {
            let finalMsg = "Search results for " + searchTerm + ":\n```";
            let maxQ = limit + 1;
            for (i = 0; i < Math.min(data.data.length, maxQ); i++) {
                const thisPlayer = data.data[i];
                if (thisPlayer.type == "player") {
                    finalMsg += thisPlayer.attributes.login + "\n";
                } else {
                    maxQ++;
                    continue;
                }
            }
            if (data.data.length > limit) {
                finalMsg += '...\n\n```Only the first ' + limit + " results are displayed";
            } else {
                finalMsg += '```';
            }
            callback(finalMsg);
        } else {
            callback("No results for this player name.");
        }
    });
}

/// Fetches player info and formats it as an embed message
function fetchPlayer(playerName, apiUrl, callback) {

    utils.httpFetch(apiUrl + 'player?filter=login=="' + playerName + '"&include=clanMembership.clan,globalRating,ladder1v1Rating,names,avatarAssignments.avatar', function (d) {

        const data = JSON.parse(d);
        if (data.data !== undefined && data.data.length > 0) {

            let player = {
                id: data.data[0].id,
                name: data.data[0].attributes.login,
                createTime: data.data[0].attributes.createTime,
                updateTime: data.data[0].attributes.updateTime,
                clans: [],
                aliases: [],
                avatarId: '',
                avatarUrl: '',
                lastAvatarTime: null
            };

            const inc = data.included;

            for (let i = 0; i < inc.length; i++) {
                let thisData = inc[i];
                switch (thisData.type) {
                    default:
                        continue;
                        break;

                    case "nameRecord":
                        player.aliases.push(thisData.attributes.name);
                        break;

                    case "clan":
                        player.clans.push({
                            name: thisData.attributes.name,
                            tag: thisData.attributes.tag,
                            size: thisData.relationships.memberships.data.length,
                            websiteUrl: thisData.attributes.websiteUrl,
                        });
                        break;

                    case "globalRating":
                        player.global = {};
                        player.global.rating = thisData.attributes.rating;
                        break;

                    case "ladder1v1Rating":
                        player.ladder = {};
                        player.ladder.rating = thisData.attributes.rating;
                        break;

                    case "avatarAssignment":
                        if (player.lastAvatarTime < Date.parse(thisData.attributes.updateTime) && thisData.attributes.selected) {
                            player.avatarId = thisData.relationships.avatar.data.id;
                            player.lastAvatarTime = Date.parse(thisData.attributes.updateTime);
                        }
                        break;
                }
            }

            for (let i = 0; i < inc.length; i++) {
                let thisData = inc[i];
                switch (thisData.type) {
                    case "avatar":
                        if (thisData.id == player.avatarId) {
                            player.avatarUrl = thisData.attributes.url.replace(/( )/g, "%20");
                        }
                        break;
                }
            }

            let embedMes = {
                "content": "Player info for [" + player.name + "]",
                "embed": {
                    "title": "ID : " + player.id + "",
                    "color": 0xFF0000,
                    "author": {
                        "name": player.name
                    },
                    "fields": []
                }
            };

            aliasString = "None";

            if (player.aliases.length > 0) {
                const maxAliases = 5; // max aliases
                aliasString = "";
                for (let i = 0; i < Math.min(player.aliases.length, maxAliases); i++) {
                    aliasString += player.aliases[i] + "\n";
                }
                if (player.aliases.length > maxAliases) {
                    aliasString += "...";
                }
            }

            embedMes["embed"].fields.push(
                {
                    "name": "Aliases",
                    "value": aliasString,
                    "inline": false
                });

            if (player.avatarUrl != '') {
                embedMes["embed"].thumbnail = {};
                embedMes["embed"].thumbnail.url = player.avatarUrl;
            }

            if (player.ladder) {
                embedMes["embed"].fields.push(
                    {
                        "name": "Ladder rating",
                        "value": "" + Math.floor(player.ladder.rating),
                        "inline": true
                    });
            }

            if (player.global) {
                embedMes["embed"].fields.push(
                    {
                        "name": "Global rating",
                        "value": "" + Math.floor(player.global.rating),
                        "inline": true
                    });
            }

            if (player.clans.length > 0) {

                for (i = 0; i < player.clans.length; i++) {
                    const thisClan = player.clans[i];
                    embedMes["embed"].fields.push(
                        {
                            "name": "Clan : " + thisClan.name + "[" + thisClan.tag + "]" + "",
                            "value": "Clan size : " + thisClan.size + "\n" + "URL : " + thisClan.websiteUrl,
                        });
                }
            }

            callback(embedMes);
            return;
        } else {
            callback("Requested player does not exist.");
            return;
        }

    });
}


module.exports = {
    isBlacklistedUser,
    fetchPlayer,
    fetchPlayerList,
    roleExists,
    isDeveloperCommand,
    isDeveloper,
    unblacklistUser,
    isModerator,
    defineSpecific,
};
