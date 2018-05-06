//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'IRC-AEOLUS', id: '0000'};
const chan = "#aeolus";

//INIT
const irc = require('funsocietyirc-client');
const client = new irc.Client(
	'faforever.com', 
	'_Discord', {
    userName: '_Discord-Uplink',
    realName: '_Discord-Dostya-Uplink',
    port: 8067,
    autoRejoin: true,
    autoConnect: true,
    retryCount: 0,
    retryDelay: 2000,
    stripColors: true,
    channels: [chan],
});

//CONNECTED!
client.addListener('registered', function (message){
    utils.log('IRC uplink established !', '--', fakeGuild);
});

//SOMETHING WENT WRONG
client.addListener('error', function(message) {
    utils.log('IRC error!', 'WW', fakeGuild);
});
client.addListener('kill', function (nick, reason, channels, message) {
    utils.log('IRC killed?!', 'WW', fakeGuild);
});

//Exports
function sendIrcMessage(str){
	utils.log("[TIRC] "+str, "++", fakeGuild);
	client.say(chan, str);
}

module.exports = {
	sendIrcMessage: function(str){
		sendIrcMessage(str);
	},
	client: client,
	fakeGuild: fakeGuild
}

//Client.nick