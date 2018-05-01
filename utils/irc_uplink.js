//UTILS
const main = require('../init_bot.js');
const utils = require('./funcs.js');
const fakeGuild = {name: 'IRC-AEOLUS', id: 'IRC-AEOLUS'};
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

//GOT MESSAGE
client.addListener('message', function (author, to, message) {
    utils.log(author + ' => ' + to + ': ' + message, 'DD', fakeGuild);
	
	//if (author != client.nick){
		let channel = main.getChannel("273508471834542091");
		if (channel != undefined){
			channel.send('**'+author+'**: '+message);
		}
	//}
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
	client.say(chan, str);
}

module.exports = {
	sendIrcMessage: function(str){
		sendIrcMessage(str);
	}
}

//Client.nick