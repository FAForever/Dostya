const bans = require('../bans');
const utils = require("../utility");
const {logForModerators} = require("./discord");

/// Initialize ban events
async function initializeBans(settings, client) {
    await bans.initialize(client.guilds);

    bans.status.on(bans.ACTIONS.WARN, function (targetGuildMember, authorGuildMember, str) {
        logForModerators(authorGuildMember.guild, "🚨 " + targetGuildMember.user.username + " has been **WARNED** by `" + authorGuildMember.user.username + "`. Reason : " + str);
    });
    bans.status.on(bans.ACTIONS.KICK, function (targetGuildMember, authorGuildMember, str) {
        logForModerators(authorGuildMember.guild, "🥊 " + targetGuildMember.user.username + " has been **KICKED** by `" + authorGuildMember.user.username + "`. Reason : " + str);
    });
    bans.status.on(bans.ACTIONS.BAN, function (targetGuildMember, authorGuildMember, str, revokeAt) {
        logForModerators(authorGuildMember.guild, "🚫 " + targetGuildMember.user.username + " has been **BANNED** by `" + authorGuildMember.user.username + "`. Reason : " + str);
        if (revokeAt) {
            logForModerators(authorGuildMember.guild, "This action will be revoked at `" + new Date(revokeAt * 1000).toLocaleString() + "`");
        }
    });
    bans.status.on(bans.ACTIONS.UN_BAN, function (targetGuildMember, authorGuildMember, str) {
        logForModerators(authorGuildMember.guild, "🛐 <@" + targetGuildMember.id + "> has been **PARDONNED** by `" + authorGuildMember.user.username + "`. Reason : " + str);
    });
    bans.status.on(bans.ACTIONS.NOTIFY, function (authorGuildMember, str) {
        logForModerators(authorGuildMember.guild, "There was an issue with your moderator action - " + str);
    });
    setInterval(function () {
        bans.updateBans(client.guilds);
    }, settings["ban-update-rate"] * 1000);
}



/// Will generate a bans.takeAction() from the action command message
async function takeActionFromMessage(message, action, commandArguments) {
    let ACTION;
    switch (action) {
        case "warn":
            ACTION = bans.ACTIONS.WARN;
            break;
        case "kick":
            ACTION = bans.ACTIONS.KICK;
            break;
        case "ban":
            ACTION = bans.ACTIONS.BAN;
            break;
        case "unban":
        case "pardon":
            ACTION = bans.ACTIONS.UN_BAN;
            break;
    }

    let i = commandArguments.indexOf(" ");
    let data = [commandArguments.slice(0, i), commandArguments.slice(i + 1)];

    let targetId;
    let str = '';

    if (i < 0) {
        targetId = utils.getIdFromString(commandArguments);
    } else {
        targetId = utils.getIdFromString(data[0]);
        str = data[1];
    }

    const author = message.member;
    let target = targetId;
    try {
        // No need to check if the user is here if we're about to unban him
        if (ACTION !== bans.ACTIONS.UN_BAN) {
            target = await message.guild.members.get(targetId);
        }
        return true;
    } catch (e) {
        if (e) {
            logForModerators(author.guild, "The action could not be completed because of an user fetching error. Is the targeted still user on this server ?");
            utils.log("Discarding moderator action from " + author.user.username + " because of an user fetching error", "WW", message.guild);
            return false;
        }
    } finally {
        if (!target) {
            logForModerators(author.guild, "The action could not be completed because the target is invalid.\nIs the target still on this server ? Did you type their ID correctly ?");
            utils.log("Discarding moderator action from " + author.user.username + " because of invalid target", "WW", message.guild);
        }

        /// Ban duration indicator
        let revokeAt = null;
        if (ACTION === bans.ACTIONS.BAN) {
            i = str.indexOf(">");
            data = [str.slice(0, i), str.slice(i + 1)];

            if (i > -1) {
                str = data[0];
                revokeAt = Date.now() + data[1] * 3600 * 1000; // Hours into miliseconds
                revokeAt /= 1000; // Miliseconds into seconds
            }
        }

        await bans.takeAction(ACTION, message.guild, target, author, str, revokeAt);
    }
}

module.exports = {
    initializeBans,
    takeActionFromMessage,
};
