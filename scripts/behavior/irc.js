const ircUpLink = require("../irc_uplink");
const utils = require("../utility.js");
const discord = require("./discord");
const user = require("./user");

let receivers = [];
let lastIrcMessage;
let ircRestarting = false;

/// Clears the receiver list
function cleanReceivers() {
    receivers = [];
}

/// Sends a message received from the IRC
function sendFromIrc(channelName, authorString, messageString) {
    for (let i = 0; i < receivers[channelName].length; i++) {
        let channel = receivers[channelName][i];
        if (channel) {
            discord.sendMessage(channel, "**" + authorString + "**: " + messageString);
        }
    }
}

/// Add to the list of receiver channels - channels that will receive IRC messages
function addToReceivers(ircChannel, channelObject) {
    if (!receivers[ircChannel]) {
        receivers[ircChannel] = [];
    }
    receivers[ircChannel].push(channelObject);
}

/// Initializes IRC connection
function initializeIrc(settings) {
    utils.log("Initializing IRC client...", "--");
    ircUpLink.status.on("connectionClosed", function (errorName) {
        if (ircUpLink.client) {
            restartIrc(settings, errorName);
        }
    });
    for (let k in settings["allowed-bridges"]) {
        ircUpLink.channels.push("#" + k);
    }
    startIrc(settings);
}

/// Properly ends IRC connection and notifies
function stopIrc(settings, errorName) {
    /// Something happened to the bridge
    for (let k in ircUpLink.channels) {
        const channel = ircUpLink.channels[k];
        sendFromIrc(channel.substr(1, channel.length), "IRC", "`Connection closed by remote host : [" + errorName + "]. Dostya will reconnect as soon as possible.`");
    }
    utils.log("Killing IRC client because of " + errorName);
    ircUpLink.killClient();
}

/// Starts IRC and sets up emitters
function startIrc() {
    if (!ircUpLink.client) {
        ircRestarting = false;
        ircUpLink.initializeClient(function (ircClient) {
            /// On irc message received, send from IRC
            for (let i = 0; i < ircUpLink.channels.length; i++) {
                const channelName = ircUpLink.channels[i];
                ircClient.on("message" + channelName, function (author, message) {
                    if (author !== ircClient.nick) {
                        utils.log("[FIRC] [FROM " + author + "#" + channelName + "] " + author + ": " + message, "++", ircUpLink.fakeGuild);
                        sendFromIrc(channelName.substr(1, channelName.length), author, message);
                    }
                });
                sendFromIrc(channelName.substr(1, channelName.length), "IRC", "`Connection established.`");
            }

            /// Add checkmark on last sent irc message on delivery
            ircClient.on("selfMessage", function (to, messageText) {
                validateLastIrcMessage(messageText);
            });
        });
    } else {
        utils.log("IRC Client already started, not starting another one.", "WW");
    }
    for (let k in ircUpLink.channels) {
        const channel = ircUpLink.channels[k];
        sendFromIrc(channel.substr(1, channel.length), "IRC", "`I'm working on Dostya, don't report double messages, please. (Dragonite)`");
    }
}

/// Stops and start irc
function restartIrc(settings, errorName) {
    if (!ircRestarting) {
        ircRestarting = true;
        stopIrc(settings, errorName);
        setTimeout(function () {
            startIrc(settings)
        }, 5000);
        return true;
    } else {
        return false;
    }
}

/// Adds a little V reaction on the last successfully sent message to the irc
function validateLastIrcMessage(messageText) {
    if (lastIrcMessage == undefined || messageText === formatIrcMessage(lastIrcMessage.author.username, lastIrcMessage.content)) {
        lastIrcMessage.react("✅");
    }
}

/// Manage message and sends to IRC
function upLink(ircChannel, message, settings) {
    if (message.channel.name == ircChannel) {
        if (lastIrcMessage != undefined) {
            lastIrcMessage.channel.fetchMessage(lastIrcMessage.id)
                .then(msg => msg.clearReactions());
        }
        lastIrcMessage = message;

        if (isUplinkAllowed(settings, ircChannel, message.guild.id)) {
            let ok = false;
            if (user.isBlacklistedUser(message.author, message.guild)) {
                utils.log("Blacklisted user " + message.author.username + " tried to use the bridge - did nothing", "--");
                message.react("❌");
            }
            discord.ifLinked(message.author.id, function (isLinked) {
                if (isLinked) {
                    utils.log("[TIRC#" + ircChannel + "] [FROM: " + message.author.id + "@" + message.guild.id + "] " + formatIrcMessage(message.author.username, message.content), "++", message.guild);
                    sendToIrc(ircChannel, message.author.username, message.content);
                    ok = true;
                    /* Uncommenting this will delete the original message and repost
                    message.channel.send("**"+message.author.username+"**: "+message.content);
                    message.delete();
                    */
                } else {
                    message.react("❌");
                    discord.sendMessage(message.author,
                        "You must link your discord account to FAF to use #" + ircChannel +
                        " with the bridge.\nUse the `!link fafAccountName` command to link your account."
                    );
                }
            });
            return ok;
        } else {
            message.react("🔇");
            return false;
        }
    } else {
        return false;
    }
}

/// Checks if the guild has write access to that IRC channel
function isUplinkAllowed(settings, channel, guildId) {
    const allowed = settings["allowed-bridges"];
    const allowedFor = allowed[channel];
    return allowedFor.indexOf(guildId) > -1;
}

/// Sends message to the IRC
function sendToIrc(channelName, authorString, messageString) {
    ircUpLink.sendIrcMessage(channelName, formatIrcMessage(authorString, messageString));
}

/// Format for IRC
function formatIrcMessage(authorString, messageString) {
    return authorString + ": " + messageString;
}


/// Starts the cooldown timer
function startCooldown(settings, coolDownObject, id) {
    if (coolDownObject == null) {
        coolDownObject = {};
    }

    coolDownObject[id] = settings.cooldown;

    setTimeout(function () {
        refreshCooldown(id, coolDownObject);
    }, 1000);
}

// Actualizes the cooldown timer
function refreshCooldown(id, coolDownObject) {

    coolDownObject[id]--;
    if (coolDownObject[id] > 0) {
        setTimeout(function () {
            refreshCooldown(id, coolDownObject);
        }, 1000);
    }
}

module.exports = {
    initializeIrc,
    addToReceivers,
    cleanReceivers,
    upLink,
    stopIrc,
    startIrc,
    restartIrc,
    startCooldown,
    isUplinkAllowed,
};
