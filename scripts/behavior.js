const bans = require("./bans");
const commands = require("./behavior/commands");
const discord = require("./behavior/discord");
const guild = require("./behavior/guild");

const irc = require("./behavior/irc");
const serverApi = require("./behavior/server_api");
const ban = require("./behavior/ban");
const user = require("./behavior/user");
const settings = require("../configuration/settings.json");
const utils = require("./utility");

// These commands won't be affected by coolDown
// TODO: these commands should be in the settings file
const coolDownWhitelist = ["subscribe", "unsubscribe"];

function escapeArguments(str) {
    str = str.replace(/\\/g, "\\\\")
        .replace(/\$/g, "\\$")
        .replace(/'/g, "\\'")
        .replace(/"/g, "\\\"");
    return str;
}

function commandNotFound(command, message, callback) {
    const specs = utils.getSpecifics(message.guild);
    if (specs["recorded-messages"][command]) {
        discord.sendMessage(message.channel, specs["recorded-messages"][command])
            .then(callback(commands.COMMAND_SUCCESS));
    } else {
        callback(commands.COMMAND_UNKNOWN);
    }
}

function ping(command, commandArguments, message,  callback) {
    return discord.replyToMessage(message, "Dostya is still up.").then(callback(commands.COMMAND_SUCCESS));
}

function searchUnit(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }

    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchUnitData(commandArguments, settings.urls.unitDB, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });

}

// TODO: fix wiki, it doesn't work
function wiki(command, commandArguments, message,  callback) {
    if (commandArguments == null || !utils.isAlphanumeric(commandArguments.replace(/ /g, ""))) {
        callback(commands.COMMAND_MISUSE);
    }

    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchWikiArticle(commandArguments, settings.urls.wiki, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function ladderPool(command, commandArguments, message,  callback) {
    serverApi.fetchLadderPool(settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function lastReplay(command, commandArguments, message,  callback) {
    if (commandArguments == null || (command === "replay" && !utils.isNumeric(commandArguments))) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchReplay(command, commandArguments, settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function clan(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchClan(commandArguments, settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function player(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    user.fetchPlayer(commandArguments, settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function map(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchMap(commandArguments, settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function searchPlayer(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    serverApi.fetchPlayerList(commandArguments, settings['player-search-limit'], settings.urls.data, function (content) {
        discord.sendMessage(message.channel, content)
            .then(callback(commands.COMMAND_SUCCESS));
    });
}

function help(command, commandArguments, message,  callback) {
    discord.sendMessage(
        message.author,
        "Consult Dostya-bot help here : \r\nhttps://github.com/FAForever/Dostya/blob/master/README.md"
    ).then(callback(commands.COMMAND_SUCCESS));
}

function sendTracker(command, commandArguments, message,  callback) {
    discord.sendTrackerFile(message.author, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function getDefinitions(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    const args = commandArguments.split(" ");
    if (args.length < 3) {
        callback(commands.COMMAND_MISUSE)
    }
    user.defineSpecific(message, args[0], args[1], args[2])
        .then(callback(commands.COMMAND_SUCCESS));
}

function restrict(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    command.restrictCommand(message.author, commandArguments, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function unRestrict(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    command.unrestrictCommand(message.author, commandArguments, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function restrictions(command, commandArguments, message,  callback) {
    command.sendRestrictions(message.author, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function blacklist(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        discord.sendBlacklist(message.author, message.guild)
            .then(callback(commands.COMMAND_SUCCESS));
        return;
    }
    discord.blacklistUser(message.author, commandArguments, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function unBlacklist(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    discord.unblacklistUser(message.author, commandArguments, message.guild)
        .then(callback(commands.COMMAND_SUCCESS));
}

function kill(command, commandArguments, message,  callback) {
    utils.log("KILL from " + message.author.username + " -- Exiting.", "XX", message.guild);
    irc.stopIrc(settings, "Dostya killed");
    process.exit(1);
}

function fixIRCBridge(command, commandArguments, message,  callback) {
    const r = irc.restartIrc(settings, "Manual restart");
    let msg;
    if (r) {
        msg = "All IRC bridges will restart in 5 seconds.";
    } else {
        msg = "Restart failed. The bridges may already be restarting.";
    }
    discord.sendMessage(message.channel, msg)
        .then(callback(commands.COMMAND_SUCCESS));
}

function link(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    const username = escapeArguments(commandArguments);
    discord.link(message, username);
    callback(commands.COMMAND_SUCCESS);
}

function showLinks(command, commandArguments, message,  callback) {
    discord.sendLinktable(message.channel, settings)
        .then(callback(commands.COMMAND_SUCCESS));
}

function unlink(command, commandArguments, message,  callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    discord.unlink(commandArguments, message.guild, function () {
        callback(commands.COMMAND_SUCCESS);
    });
}

function logHere(command, commandArguments, message, callback) {
    let specifics = utils.getSpecifics(message.guild);
    specifics['moderator-log-channel'] = message.channel.id;
    utils.writeSpecifics(message.guild, specifics);
    utils.log('Registered #' + message.channel.name + ' for logging', '>>', message.guild);
    discord.logForModerators(message.guild, "Registered `" + message.channel.name + "` for logging");
    callback(commands.COMMAND_SUCCESS);
}

function logMapsHere(command, commandArguments, message, callback) {
    let newSpecs = utils.getSpecifics(message.guild);
    newSpecs['map-watch-channels'].push(message.channel.id);
    utils.writeSpecifics(message.guild, newSpecs);
    utils.log('Registered #' + message.channel.name + ' for map watching', '>>', message.guild);
    discord.sendMessage(message.channel, "Registered `" + message.channel.name + "` for map watching");
    callback(commands.COMMAND_SUCCESS);
}

function unLogMapsHere(command, commandArguments, message, callback) {
    let unLogSpecs = utils.getSpecifics(message.guild);
    unLogSpecs['map-watch-channels'] = unLogSpecs['map-watch-channels'].filter(chan => chan !== message.channel.id);
    utils.writeSpecifics(message.guild, unLogSpecs);
    utils.log('Removed #' + message.channel.name + ' from map watching list', '--', message.guild);
    discord.sendMessage(message.channel, 'Removed `' + message.channel.name + '` from map watching list');
    callback(commands.COMMAND_SUCCESS);
}

function flushMaps(command, commandArguments, message, callback) {
    utils.log("Maps table flushed by " + message.author.username, "!!");
    command.flushMaps();
    callback(commands.COMMAND_SUCCESS);
}

function testLog(command, commandArguments, message, callback) {
    discord.logForModerators(message.guild, "This is the moderator logging channel");
    callback(commands.COMMAND_SUCCESS);
}

function record(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments).replace("\\\\", "\\");

    const i = commandArguments.indexOf(" ");
    const recording = [commandArguments.slice(0, i), commandArguments.slice(i + 1)];

    if (i < 0) {
        if (recording.length > 1) {
            guild.deleteRecord(message.guild, settings, commandArguments);
            callback(commands.COMMAND_SUCCESS);
            return;
        } else {
            callback(commands.COMMAND_MISUSE);
            return;
        }
    }
    guild.addRecord(message.guild, settings, recording[0], recording[1]);
    callback(commands.COMMAND_SUCCESS);
}

function showRecrods(command, commandArguments, message, callback) {
    discord.sendRecords(message.channel, settings);
        callback(commands.COMMAND_SUCCESS);
}

function takeActionFromMessage(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    ban.takeActionFromMessage(message, command, commandArguments)
        .then(callback(commands.COMMAND_SUCCESS));
}

function userInfo(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    commandArguments = escapeArguments(commandArguments);
    let id = utils.getIdFromString(commandArguments);
    if (utils.isNumeric(commandArguments)) {
        id = commandArguments;
    }
    bans.getUserInfo(message.guild, id, function (content) {
        discord.logForModerators(message.guild, content);
    }).then(
        callback(commands.COMMAND_SUCCESS)
    );
}

function createRole(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    let roleName = escapeArguments(commandArguments);

    if (user.roleExists(roleName, message.guild)) {
        discord.sendMessage(message.channel, "Role already registered.")
            .then(callback(commands.COMMAND_MISUSE));
        return;
    }

    discord.createRole(roleName, message)
        .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));
}

function deleteRole(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    let delRoleName = escapeArguments(commandArguments);

    if (!user.roleExists(delRoleName, message.guild)) {
        discord.sendMessage(message.channel, "Role not registered. Are you sure the spelling is correct?")
            .then(callback(commands.COMMAND_MISUSE));
        return;
    }

    user.deleteRole(delRoleName, message)
        .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));
}

function subscribe(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    let subscribeRoleName = escapeArguments(commandArguments);

    if (!user.roleExists(subscribeRoleName, message.guild)) {
        discord.sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
            .then(callback(commands.COMMAND_MISUSE));
        return;
    }

    discord.subscribe(subscribeRoleName, message)
        .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));
}

function unsubscribe(command, commandArguments, message, callback) {
    if (commandArguments == null) {
        callback(commands.COMMAND_MISUSE);
        return;
    }
    let unsubscribeRoleName = escapeArguments(commandArguments);

    if (!user.roleExists(unsubscribeRoleName, message.guild)) {
        discord.sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
            .then(callback(commands.COMMAND_MISUSE));
        return;
    }

    discord.unsubscribe(unsubscribeRoleName, message)
        .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));
}

function roles(command, commandArguments, message, callback) {
    const specificsSubscriptions = utils.getSpecifics(message.guild);

    let subscriptionsMessage = specificsSubscriptions["registeredRoles"].join("\n");
    discord.sendMessage(message.channel, subscriptionsMessage)
        .then(callback(commands.COMMAND_SUCCESS));
}

const COMMANDS_MAP = {
    respond: ping,
    alive: ping,
    unit: searchUnit,
    searchunit: searchUnit,
    wiki,
    pool: ladderPool,
    ladderpool: ladderPool,
    ladder: ladderPool,
    mappool: ladderPool,
    replay: lastReplay,
    lastreplay: lastReplay,
    clan,
    player,
    ratings: player,
    map,
    searchplayer: searchPlayer,
    help,
    sendtracker: sendTracker,
    tracker: sendTracker,
    def: getDefinitions,
    "define": getDefinitions,
    restrict: restrict,
    unrestrict: unRestrict,
    restrictions,
    blacklist,
    unblacklist: unBlacklist,
    kill,
    fixbridge: fixIRCBridge,
    link,
    links: showLinks,
    showLinks,
    unlink,
    loghere: logHere,
    logmapshere: logMapsHere,
    unlogmapshere: unLogMapsHere,
    flushmaps: flushMaps,
    testlog: testLog,
    record,
    showrecords: showRecrods,
    records: showRecrods,
    warn: takeActionFromMessage,
    kick: takeActionFromMessage,
    ban: takeActionFromMessage,
    unban: takeActionFromMessage,
    pardon: takeActionFromMessage,
    userinfo: userInfo,
    createrole: createRole,
    deleterole: deleteRole,
    subscribe,
    unsubscribe,
    roles,
};


function onPrefixFound(message, callback) {
    let content = message.content;
    for (let i = 0; i < settings.prefixes.length; i++) {
        const prefix = settings.prefixes[i];
        if (content.startsWith(prefix)) {
            content = content.replace(prefix, "").trim();
            break;
        }
    }

    let command = content.split(" ", 1)[0].toLowerCase();
    if (COMMANDS_MAP[command]) {
        let commandArguments = command.split(" ").slice(1).join(" ");
        callback(command, commandArguments);
    }
}


function executeCommand(command, commandArguments, coolDown, message, callback) {
    const isDeveloper = user.isDeveloper(message.author, settings);
    const isModerator = user.isModerator(message.member, message.guild);

    if (!isDeveloper && settings["dev-only-mode"]) {
        utils.log(message.author.username + " tried to fire command while in dev-only mode", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!isDeveloper && !isModerator && coolDown > 0 && coolDownWhitelist.indexOf(command) < 0) {
        /// Animates coolDown
        discord.animateCooldown(message);
        callback(commands.COMMAND_COOL_DOWN);
    } else if (!isDeveloper && user.isDeveloperCommand(command, settings)) {
        utils.log(message.author.username + " tried to fire a developer command without being dev", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!isDeveloper && commands.isRestrictedCommand(command, message.guild) && !user.isModerator(message.member, message.guild)) {
        utils.log(message.author.username + " tried to fire a restricted command", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!isDeveloper && user.isBlacklistedUser(message.author, message.guild)) {
        utils.log(message.author.username + " tried to fire a command, but is blacklisted", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else {
        const commandToRun = COMMANDS_MAP[command];
        if (commandToRun) {
            commandToRun(command, commandArguments, message, callback);
            return;
        }

        commandNotFound(command, message, callback);
    }
}

module.exports = {
    onPrefixFound,
    executeCommand,
    COMMANDS_MAP,
};
