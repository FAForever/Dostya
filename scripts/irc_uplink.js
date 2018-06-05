//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'IRC-AEOLUS', id: '0000'};
const chan = "#aeolus";

//INIT
const irc = require('funsocietyirc-client');
let client;
let reinitializing = false;
let successfullConnection = false;

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
	reinitializing = false;
	
	//CONNECTED!
	client.on('registered', function (message){
		utils.log('IRC uplink established !', '--', fakeGuild);
		successfullConnection = true;
		callback(client);
	});

	//SOMETHING WENT WRONG
	const errors = ['error', 'abort', 'kill', 'netError', 'connectionEnd', 'unhandled'];
	const restartEvery = 3000;
	
	for (let i = 0; i < errors.length; i++){
		client.on(errors[i], function(message) {
			if (successfullConnection){
				successfullConnection = false;
				utils.log('IRC error : ['+errors[i]+']. Restarting every '+restartEvery+' until successfull connection', 'WW', fakeGuild);
			}
			if (!reinitializing){
				reinitializing = true;
				setTimeout(function ()
					{ initializeClient(function(){});}, 
					restartEvery
				);
			}
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