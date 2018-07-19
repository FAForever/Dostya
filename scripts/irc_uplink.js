//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'IRC-CONNCTN', id: '0000'};
let channels = [];

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
		channels: channels,
	});
	reinitializing = false;
	
	//CONNECTED!
	client.on('registered', function (message){
		utils.log('IRC uplink established !', '--', fakeGuild);
		successfullConnection = true;
		callback(client);
	});

	//SOMETHING WENT WRONG
	const errors = ['error', 'abort', 'kill', 'netError', 'connectionEnd'];
	const restartEvery = 30000;
	
	for (let i = 0; i < errors.length; i++){
		client.on(errors[i], function(message) {
			if (successfullConnection){
				successfullConnection = false;
				utils.log('IRC error : ['+errors[i]+'] : ['+JSON.stringify(message)+']. Restarting every '+(restartEvery/1000)+'seconds until successfull connection', 'WW', fakeGuild);
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
function sendIrcMessage(channel, str){
	client.say("#"+channel, str);
}

module.exports = {
	sendIrcMessage: function(channel, str){
		sendIrcMessage(channel, str);
	},
	initializeClient: function(callback){
		return initializeClient(callback);
	},
	client: client,
	fakeGuild: fakeGuild,
	channels: channels
}

//Client.nick