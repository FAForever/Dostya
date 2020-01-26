const Discord = require("discord.js");

const discord = require("./behavior/discord");
const utils = require("./utility");

const irc = require("./behavior/irc");
const commands = require("./behavior/commands");
const db = require("./db");
const serverApi = require("./behavior/server_api");
const rss = require("./behavior/rss");
const ban = require("./behavior/ban");
const behavior = require("./behavior");

/// Variable initialization
let currentCooldown = {};
const settings = require("../configuration/settings.json");

const client = new Discord.Client();

/// Client ready
client.on("ready", () => {
    utils.log("Dostya ready !");
    client.user.setActivity("!help");
    refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
    irc.initializeIrc(settings);
    db.initializeDatabase(settings);
    serverApi.initializeMapWatching(settings, client);
    rss.initializeRss(settings);
    ban.initializeBans(settings, client).then();
});

/// Client error
client.on("error", function (err) {
    utils.log("Dostya encountered an error: " + err.message, "WW");
});

/// Client disconnect
client.on("disconnect", () => {
    utils.log("Dostya has disconnected", "WW");
});

/// Refreshing IRC receivers
client.on("guildCreate", guild => {
    utils.log("Dostya has been added to guild " + guild.name + "", "!!");
    refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
});
client.on("channelCreate", guild => {
    if (guild.name) {
        /// If guild.name is undefined, it is very likely this "channel" is a PM channel. No need to refresh the IRC receivers in that case.
        refreshReceivers(settings, client);
        refreshAnnouncers(settings, client);
    }
});
client.on("channelDelete", guild => {
    refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
});

/// Adding guildmember
client.on("guildMemberAdd", guildMember => {
    utils.log("User " + guildMember.user.username + "  joined the guild", "TR", guildMember.guild);
    utils.track(guildMember);
    discord.sendWelcomeMessageTo(guildMember)
});

/// Received message
client.on("message", message => {
    /// A few cases when the bot should be doing nothing : either empty guild or message is from myself
    if (message.author.id === client.user.id || !message.guild) {
        return;
    }

    /// IRC transmission - if needed
    if (settings["allowed-bridges"][message.channel.name] !== undefined) {
        irc.upLink(message.channel.name, message, settings);
        return;
    }

    discord.aliasCommand(message, settings);

    commands.onPrefixFound(message, function (command, commandArgs) {
        console.log(currentCooldown[message.guild.id]);
        behavior.executeCommand(
            command, commandArgs, currentCooldown[message.guild.id], message,
            onCommandExecuted.bind(this, command, message, commandArgs)
        );
    });

});

function onCommandExecuted(command, message, commandArgs, state, err) {
    if (err) {
        utils.log(`Error occurred during executing command: ${command}, message: ${message.guild}, ${commandArgs}`);
    }

    utils.log("[" + message.author.username + "] fired [" + command + "]", "!!", message.guild);

    switch (state) {

        default: // should not happen!
            utils.log("Invalid command state - Please check command [" + command + "] with argument [" + commandArgs + "]", "><", message.guild);
            break;

        /// 0 means the command executed gracefully
        case commands.COMMAND_SUCCESS:
            utils.log("EOI with " + message.author.username + "", "OK", message.guild);
            irc.startCooldown(settings, currentCooldown, message.guild.id);
            break;

        /// 1 means the command could be executed because of cooldown
        case commands.COMMAND_COOL_DOWN:
            utils.log("On cooldown, ignoring [" + command + "]", "--", message.guild);
            break;

        /// 2 is command not found
        case commands.COMMAND_UNKNOWN:
            utils.log("Could not find [" + command + "]", "--", message.guild);
            break;

        /// 3 is command misuse
        case commands.COMMAND_MISUSE:
            utils.log("Misuse of command [" + command + "]", "--", message.guild);
            break;

        /// 4 is command forbidden
        case commands.COMMAND_FORBIDDEN:
            utils.log("Command forbidden in current state [" + command + "]", "--", message.guild);
            break;
    }
}

function refreshReceivers(settings, client) {
    utils.log("Refreshing receivers...", "--");
    irc.cleanReceivers();
    for (let k in settings["allowed-bridges"]) {
        if (settings["allowed-bridges"][k].length > 0) {
            for (let i = 0; i < client.guilds.array().length; i++) {
                const guild = client.guilds.array()[i];
                const channel = guild.channels.find("name", k);
                if (channel != null && channel.type === "text") {
                    irc.addToReceivers(k, channel);
                    utils.log("Added [" + guild.name + "] #" + channel.name + " to receivers", ">>", guild);
                }
            }
        }
    }
}

function refreshAnnouncers(settings, client) {
    const guilds = client.guilds;
    rss.cleanAnnouncers();
    for (const guild of guilds.values()) {
        const specs = utils.getSpecifics(guild);
        const channelIds = specs["announcement-channels"];
        for (let l in channelIds) {
            const channelId = utils.getIdFromString(channelIds[l]);
            const channel = guild.channels.find("id", channelId);
            rss.addToAnnouncers(channel);
            utils.log("Added [" + guild.name + "] #" + channel.name + " to announcers", ">>", guild);
        }
    }
}


module.exports = {
    client
};