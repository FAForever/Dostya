//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'IRC-AEOLUS', id: '0000'};
const chan = "#aeolus";

//INIT
const irc = require('funsocietyirc-client');
let client;

function initializeClient(callback){
	client = new irc.Client(
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
	client.on('registered', function (message){
		utils.log('IRC uplink established !', '--', fakeGuild);
		callback(client);
	});

	//SOMETHING WENT WRONG
	const errors = ['error', 'abort', 'kill', 'netError', 'connectionEnd', 'unhandled'];
	
	for (let i = 0; i < errors.length; i++){
		client.on(errors[i], function(message) {
			utils.log('IRC error : ['+errors[i]+']. Reinitializing...', 'WW', fakeGuild);
			initializeClient();
		});
		
	}
}
//Exports
function sendIrcMessage(str){
	utils.log("[TIRC] "+str, "++", fakeGuild);
	client.say(chan, str);
}

module.exports = {
	sendIrcMessage: function(str){
		sendIrcMessage(str);
	},
	initializeClient: function(callback){
		return initializeClient(callback);
	},
	client: client,
	fakeGuild: fakeGuild,
	chan: chan
}

//Client.nick