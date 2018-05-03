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
const token = require('./_private/token.json');
const settings = require('./configuration/settings.json');
const databaseFile = './_private/userdata.db';  

/// Variable initialization
let db = new sqlite3.Database(databaseFile);  
let currentCooldown = {};

utils.log('Dostya launched ! Preparing...');

/// Client ready
client.on('ready', () => {
	utils.log('Dostya ready !');
	client.user.setActivity("!help");
	refreshReceivers(client);
});

/// Client error
client.on('error', function(err){
	utils.log('Dostya encountered an error: '+err.message, 'WW');
});

/// Client disconnect
client.on('disconnect', () => {
  utils.log('Dostya has disconnected', 'WW');
});

client.on('guildCreate', guild =>{
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
	behavior.uplink(message);
	
	/// Aliasing
	behavior.aliasCommand(message, settings);
	
	behavior.onPrefixFound(message, settings, utils, function(command, arguments){
		
		behavior.executeCommand(command, arguments, currentCooldown[message.guild.id], message, settings, utils, function(state, err){
			
			if (state === 0){
				behavior.startCooldown(settings, currentCooldown, message.guild.id);
			}
			
		});
		
	});
	
	/*
	//////////////////////
	// INPUT DETECTION
	//////////////////////
	if (talkingToMe){	//It does => Execing command
		  //Exit if on cooldown
		if (onCooldown[message.guild.id]){
				message.react("🇼")
				.then(() => message.react("🇦"))
				.then(() => message.react("🇮"))
				.then(() => message.react("🇹"));
	            utils.log('On cooldown, ignoring ['+message.content+']', '--', message.guild);
	            return;
	        }

		let canDo = true;
		if (settings["dev-only-mode"]){
			const aId = parseInt(message.author.id)
			if (settings["devs"].indexOf(aId, settings["devs"]) < 0){
				utils.log(message.author.username+' is not a developper, and dev-only-mode activated. Doing nothing.', '><', message.guild);
				canDo = false;
			}
		}
		if (canDo){
			utils.log("Reacting to ["+msgString+"] ...", "..", message.guild);
			behavior.react(message, function(result){
				
				if (result === false){
					utils.log("...failed!", "WW", message.guild);
				}
				else if (result === null){
					utils.log("...nothing to respond to that.", "><", message.guild);
				}
				else if (result === true){
					issuedCommand = true;
					utils.log("...end of interaction.", "OK", message.guild);
				}
				else{
					issuedCommand = true;
				}
			});
		}
	}
	//////////////////////
	// POINT-ADDING BEHAVIOR
	//////////////////////
	if (!issuedCommand){
		let fakeList = [];
		fakeList.push(message.author.id);
		behavior.addPoints(db, fakeList, .3);
	}
	else{
		//User issued command : cooldown mode
	}
	*/
});


//ON EXCEPTION
process.on('uncaughtException', function(err) {
  utils.log('-------------------------', 'XX');
  utils.log('CRASH AVOIDED! ' + err, 'XX');
  console.log(err);
  utils.log('-------------------------', 'XX');
});

function refreshReceivers(client){
	behavior.cleanReceivers();
	for (let i = 0; i < client.guilds.array().length; i++){
		const guild = client.guilds.array()[i];
		const channel = guild.channels.find("name", "aeolus");
		if (channel != null && channel.type == "text"){
			behavior.addToReceivers(channel);
			utils.log("Added "+guild.name+">>"+channel.name+" to receivers");
		}
	}
}


client.login(token.token);
