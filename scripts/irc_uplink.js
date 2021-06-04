//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'IRC-BRIDGE', id: '0000'};
let channels = [];

//INIT
const irc = require('funsocietyirc-client');
const EventEmitter = require('events');
const status = new EventEmitter();
let client;
let reinitializing = false;

function initializeClient(callback) {
    client = new irc.Client(
        'faforever.com',
        '_Discord', {
            userName: '_Discord-Uplink',
            realName: '_Discord-Dostya-Uplink',
            port: 6667,
            autoRejoin: false,
            autoConnect: true,
            retryCount: 0,
            retryDelay: 2000,
            stripColors: true,
            channels: channels,
        });

    //CONNECTED!
    client.on('registered', function (message) {
        utils.log('IRC uplink established !', '--', fakeGuild);
        callback(client);
    });

    //SOMETHING WENT WRONG
    const errors = ['error', 'abort', 'kill', 'netError', 'connectionEnd', 'kick'];

    for (let i = 0; i < errors.length; i++) {
        client.on(errors[i], function (message, a, b, c, d) {
            if (!reinitializing) {
                switch (errors[i]) {
                    default:
                        utils.log('IRC error : [' + errors[i] + '] : [' + JSON.stringify(message) + ']. Connection presumably dropped.', 'WW', fakeGuild);
                        status.emit("connectionClosed", errors[i]);
                        break;

                    case "kick":
                        if (a === client.nick) {
                            utils.log('IRC kicked. Connection presumably dropped.', 'WW', fakeGuild);
                            status.emit("connectionClosed", errors[i]);
                        }
                        break;

                    case "kill":
                        if (message === client.nick) {
                            utils.log('IRC kicked. Connection presumably dropped.', 'WW', fakeGuild);
                            status.emit("connectionClosed", errors[i]);
                        }
                        break;
                }
            }
        });
    }
}

function killClient() {
    reinitializing = true;
    try {
        client.disconnect();
        client = undefined;
    } catch (e) {
        utils.log('Error on IRC while disconnecting  - Bot was probably already disconnected', 'WW', fakeGuild);
        console.log(e);
    }
    reinitializing = false;
    utils.log('Client killed', '--', fakeGuild);
}

function sendIrcMessage(channel, str) {
    console.log("sendIrcMessage -------------------");
    console.log(channel.name, str);
    console.log("-------------------");
    client.say("#" + channel, str); // TODO: remove
}

module.exports = {
    sendIrcMessage,
    initializeClient,
    killClient,
    client,
    fakeGuild,
    channels,
    status,
};
