const bans = require("./bans");
const commands = require("./behavior/commands");
const discord = require("./behavior/discord");
const guild = require("./behavior/guild");

const irc = require("./behavior/irc");
const serverApi = require("./behavior/server_api");
const rss = require("./behavior/rss");
const ban = require("./behavior/ban");
const user = require("./behavior/user");

// These commands won't be affected by cooldown
// TODO: these commands should be in the settings file
const coolDownWhitelist = ["subscribe", "unsubscribe"];

function escapeArguments(str) {
    str = str.replace(/\\/g, "\\\\")
        .replace(/\$/g, "\\$")
        .replace(/'/g, "\\'")
        .replace(/"/g, "\\\"");
    return str;
}

function executeCommand(command, arguments, cooldown, message, settings, utils, callback) {

    const developer = user.isDeveloper(message.author, settings);

    if (!developer && settings["dev-only-mode"]) {
        utils.log(message.author.username + " tried to fire command while in dev-only mode", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!developer && cooldown > 0 && coolDownWhitelist.indexOf(command) < 0) {
        /// Animates cooldown
        discord.animateCooldown(message, cooldown);
        callback(commands.COMMAND_COOL_DOWN);
    } else if (!developer && user.isDeveloperCommand(command, settings)) {
        utils.log(message.author.username + " tried to fire a developer command without being dev", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!developer && user.isRestrictedCommand(command, message.guild) && !isModerator(message.member, message.guild)) {
        utils.log(message.author.username + " tried to fire a restricted command", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else if (!developer && user.isBlacklistedUser(message.author, message.guild)) {
        utils.log(message.author.username + " tried to fire a command, but is blacklisted", "!!", message.guild);
        callback(commands.COMMAND_FORBIDDEN);
    } else {
        switch (command) {
            default:
                const specs = utils.getSpecifics(message.guild);
                if (specs["recorded-messages"][command]) {
                    discord.sendMessage(message.channel, specs["recorded-messages"][command])
                        .then(callback(commands.COMMAND_SUCCESS));
                } else {
                    callback(commands.COMMAND_UNKNOWN);
                }
                break;

            case "respond":
            case "alive":
                discord.replyToMessage(message, "Dostya is still up.")
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "unit":
            case "searchunit":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchUnitData(arguments, settings.urls.unitDB, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "wiki":
                if (arguments == null || !utils.isAlphanumeric(arguments.replace(/ /g, ""))) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchWikiArticle(arguments, settings.urls.wiki, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "pool":
            case "ladderpool":
            case "ladder":
            case "mappool":
                serverApi.fetchLadderPool(settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "replay":
            case "lastreplay":
                if (arguments == null || (command === "replay" && !utils.isNumeric(arguments))) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchReplay(command, arguments, settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "clan":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchClan(arguments, settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "player":
            case "ratings":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchPlayer(arguments, settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "map":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchMap(arguments, settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "searchplayer":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                serverApi.fetchPlayerList(arguments, settings['player-search-limit'], settings.urls.data, function (content) {
                    discord.sendMessage(message.channel, content)
                        .then(callback(commands.COMMAND_SUCCESS))
                });
                break;

            case "help":
                discord.sendMessage(message.author, "Consult Dostya-bot help here : \r\nhttps://github.com/FAForever/Dostya/blob/master/README.md")
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "sendtracker":
            case "tracker":
                discord.sendTrackerFile(message.author, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "def":		/// !def announcement-channels array #test
            case "define":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                const args = arguments.split(" ");
                if (args.length < 3) {
                    callback(commands.COMMAND_MISUSE)
                }
                user.defineSpecific(message, args[0], args[1], args[2])
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "restrict":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                command.restrictCommand(message.author, arguments, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "unrestrict":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                command.unrestrictCommand(message.author, arguments, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "restrictions":
                command.sendRestrictions(message.author, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "blacklist":
                if (arguments == null) {
                    discord.sendBlacklist(message.author, message.guild)
                        .then(callback(commands.COMMAND_SUCCESS));
                    break;
                }
                discord.blacklistUser(message.author, arguments, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "unblacklist":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                discord.unblacklistUser(message.author, arguments, message.guild)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "kill":
                utils.log("KILL from " + message.author.username + " -- Exiting.", "XX", message.guild);
                irc.stopIrc(settings, "Dostya killed");
                process.exit(1);
                break;

            case "fixbridge":
                const r = irc.restartIrc(settings, "Manual restart");
                let msg;
                if (r) {
                    msg = "All IRC bridges will restart in 5 seconds.";
                } else {
                    msg = "Restart failed. The bridges may already be restarting.";
                }
                discord.sendMessage(message.channel, msg)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "link":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                const username = escapeArguments(arguments);
                discord.link(message, username);
                callback(commands.COMMAND_SUCCESS);
                break;

            case "links":
            case "showlinks":
                discord.sendLinktable(message.channel, settings)
                    .then(callback(commands.COMMAND_SUCCESS));
                break;

            case "unlink":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                discord.unlink(arguments, message.guild, function () {
                    callback(commands.COMMAND_SUCCESS);
                });
                break;

            case "loghere":
                let specifics = utils.getSpecifics(message.guild);
                specifics['moderator-log-channel'] = message.channel.id;
                utils.writeSpecifics(message.guild, specifics);
                utils.log('Registered #' + message.channel.name + ' for logging', '>>', message.guild);
                discord.logForModerators(message.guild, "Registered `" + message.channel.name + "` for logging");
                callback(commands.COMMAND_SUCCESS);
                break;

            case "logmapshere":
                let newSpecs = utils.getSpecifics(message.guild);
                newSpecs['map-watch-channels'].push(message.channel.id);
                utils.writeSpecifics(message.guild, newSpecs);
                utils.log('Registered #' + message.channel.name + ' for map watching', '>>', message.guild);
                discord.sendMessage(message.channel, "Registered `" + message.channel.name + "` for map watching");
                callback(commands.COMMAND_SUCCESS);
                break;

            case "unlogmapshere":
                let unlogSpecs = utils.getSpecifics(message.guild);
                unlogSpecs['map-watch-channels'] = unlogSpecs['map-watch-channels'].filter(chan => chan !== message.channel.id);
                utils.writeSpecifics(message.guild, unlogSpecs);
                utils.log('Removed #' + message.channel.name + ' from map watching list', '--', message.guild);
                discord.sendMessage(message.channel, 'Removed `' + message.channel.name + '` from map watching list');
                callback(commands.COMMAND_SUCCESS);
                break;

            case "flushmaps":
                utils.log("Maps table flushed by " + message.author.username, "!!");
                command.flushmaps();
                callback(commands.COMMAND_SUCCESS);
                break;

            case "testlog":
                discord.logForModerators(message.guild, "This is the moderator logging channel");
                callback(commands.COMMAND_SUCCESS);
                break;

            case "record":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments).replace("\\\\", "\\");

                const i = arguments.indexOf(" ");
                const recording = [arguments.slice(0, i), arguments.slice(i + 1)];

                if (i < 0) {
                    if (recording.length > 1) {
                        guild.deleteRecord(message.guild, settings, arguments);
                        callback(commands.COMMAND_SUCCESS);
                        break;
                    } else {
                        callback(commands.COMMAND_MISUSE);
                        break;
                    }
                }
                guild.addRecord(message.guild, settings, recording[0], recording[1]);
                callback(commands.COMMAND_SUCCESS);
                break;

            case "showrecords":
            case "records":
                discord.sendRecords(message.channel, settings);
                callback(commands.COMMAND_SUCCESS);
                break;

            case "warn":
            case "kick":
            case "ban":
            case "unban":
            case "pardon":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                ban.takeActionFromMessage(message, command, arguments)
                    .then(callback(commands.COMMAND_SUCCESS));

                break;

            case "userinfo":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                let id = utils.getIdFromString(arguments);
                if (utils.isNumeric(arguments)) {
                    id = arguments;
                }
                bans.getUserInfo(message.guild, id, function (content) {
                    discord.logForModerators(message.guild, content);
                }).then(
                    callback(commands.COMMAND_SUCCESS)
                );

                break;

            case "createrole":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                let roleName = escapeArguments(arguments);

                if (user.roleExists(roleName, message.guild)) {
                    discord.sendMessage(message.channel, "Role already registered.")
                        .then(callback(commands.COMMAND_MISUSE));
                    break;
                }

                discord.createRole(roleName, message)
                    .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));

                break;

            case "deleterole":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                let delRoleName = escapeArguments(arguments);

                if (!user.roleExists(delRoleName, message.guild)) {
                    discord.sendMessage(message.channel, "Role not registered. Are you sure the spelling is correct?")
                        .then(callback(commands.COMMAND_MISUSE));
                    break;
                }

                user.deleteRole(delRoleName, message)
                    .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));

                break;

            case "subscribe":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                let subscribeRoleName = escapeArguments(arguments);

                if (!user.roleExists(subscribeRoleName, message.guild)) {
                    discord.sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
                        .then(callback(commands.COMMAND_MISUSE));
                    break;
                }

                discord.subscribe(subscribeRoleName, message)
                    .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));

                break;

            case "unsubscribe":
                if (arguments == null) {
                    callback(commands.COMMAND_MISUSE);
                    break;
                }
                let unsubscribeRoleName = escapeArguments(arguments);

                if (!user.roleExists(unsubscribeRoleName, message.guild)) {
                    discord.sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
                        .then(callback(commands.COMMAND_MISUSE));
                    break;
                }

                discord.unsubscribe(unsubscribeRoleName, message)
                    .then(callback(commands.COMMAND_SUCCESS), callback(commands.COMMAND_SUCCESS));

                break;

            case "roles":

                let specificsSubscriptions = utils.getSpecifics(message.guild);

                let subscriptionsMessage = specificsSubscriptions["registeredRoles"].join("\n");
                discord.sendMessage(message.channel, subscriptionsMessage)
                    .then(callback(commands.COMMAND_SUCCESS));

                break;
        }
    }
}

module.exports = {
    executeCommand
};
