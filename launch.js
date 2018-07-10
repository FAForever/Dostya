/// Libraries
const Discord = require('discord.js');
const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();

const client = new Discord.Client();
module.exports = {
   getChannel: function(str){	return client.channels.get(str);}
}
// Scripts
const utils = require('./scripts/utility.js');
const behavior = require('./scripts/behavior.js');

/// Configuration
const privateDir = './_private';
const tokenPath = privateDir+'/token.json';

utils.checkToken(privateDir, tokenPath);

const token = require(tokenPath);
const settings = require('./configuration/settings.json');
const databaseFile = privateDir+'/userdata.db';  

/// Variable initialization
let db = new sqlite3.Database(databaseFile);  
let currentCooldown = {};

utils.log('Dostya launched ! Preparing...');

/// Client ready
client.on('ready', () => {
	utils.log('Dostya ready !');
	client.user.setActivity("!help");
	refreshReceivers(client);
	behavior.initializeIrc()
});

/// Client error
client.on('error', function(err){
	utils.log('Dostya encountered an error: '+err.message, 'WW');
});

/// Client disconnect
client.on('disconnect', () => {
  utils.log('Dostya has disconnected', 'WW');
});

/// Refreshing IRC receivers
client.on('guildCreate', guild =>{
	utils.log('Dostya has been added to guild '+guild.name+'', '!!');
	refreshReceivers(client);
});
client.on('channelCreate', guild=>{
	refreshReceivers(client);
});
client.on('channelDelete', guild=>{
	refreshReceivers(client);
});

/// Adding guildmember
client.on('guildMemberAdd', guildMember=>{
	utils.log('User "'+guildMember.user.username+'" joined the guild', 'TR', guildMember.guild);
	utils.track(guildMember);
	behavior.sendWelcomeMessageTo(guildMember)
});

/// Received message
client.on('message', message => {
	
	/// A few cases when the bot should be doing nothing : either empty guild or message is from myself
	if (message.author.id == client.user.id ||
		!message.guild){
		return;
	}
	
	/// Aeolus transmission - if needed
	behavior.uplink(message, settings);
	
	/// Aliasing
	behavior.aliasCommand(message, settings);
	
	behavior.onPrefixFound(message, settings, utils, function(command, arguments){
		
		behavior.executeCommand(command, arguments, currentCooldown[message.guild.id], message, settings, utils, function(state, err){
			
			utils.log("["+message.author.username+"] fired ["+command+"]", "!!", message.guild);
			
			switch(state){
				
				default: // should not happen!
					utils.log("Invalid command state - Please check command ["+command+"] with argument ["+argument+"]", "><", message.guild);
					break;
				
				/// 0 means the command executed gracefully
				case behavior.COMMAND_SUCCCESS:
					utils.log("EOI with "+message.author.username+"", "OK", message.guild);
					behavior.startCooldown(settings, currentCooldown, message.guild.id);
					break;
				
				/// 1 means the command could be executed because of cooldown
				case behavior.COMMAND_COOLDOWN:
					utils.log("On cooldown, ignoring ["+command+"]", "--", message.guild);
					break;
				
				/// 2 is command not found
				case behavior.COMMAND_UNKNOWN:
					utils.log("Could not find ["+command+"]", "--", message.guild);
					break;
				
				/// 3 is command misuse
				case behavior.COMMAND_MISUSE:
					utils.log("Misuse of command ["+command+"]", "--", message.guild);
					break;
				
				/// 4 is command forbidden
				case behavior.COMMAND_FORBIDDEN:
					utils.log("Command forbidden in current state ["+command+"]", "--", message.guild);
					break;
			}
		});
		
	});
	
});


//ON EXCEPTION
process.on('uncaughtException', function(err) {
  utils.log('-------------------------', 'XX');
  utils.log('CRASH AVOIDED! ' + err, 'XX');
  console.log(err);
  utils.log('-------------------------', 'XX');
});

process.on('SIGINT', function() {
    utils.log("SIGINT - Exiting", "XX")
    process.exit();
});

function refreshReceivers(client){
    utils.log("Refreshing receivers...", "--");
	behavior.cleanReceivers();
	for (let i = 0; i < client.guilds.array().length; i++){
		const guild = client.guilds.array()[i];
		const channel = guild.channels.find("name", "aeolus");
		if (channel != null && channel.type == "text"){
			behavior.addToReceivers(channel);
			utils.log("Added ["+guild.name+"] #"+channel.name+" to receivers", ">>");
		}
	}
}


client.login(token.token);
