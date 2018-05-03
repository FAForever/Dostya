///////////////////
///
/// This behavior script handles most of the bot behavior
/// 
///
///////////////////


const sqlite3 = require('sqlite3').verbose();
const fs = require("fs");
const https = require('https');
const http = require('http');

const ircUplink = require('./irc_uplink.js');
const utils = require('./utility.js');
let receivers = [];

/// On irc message received, send from IRC
ircUplink.client.addListener('message', function (author, to, message) {
	sendFromIrc(author, message);
});

/// Clears the receiver list
function cleanReceivers(){
	receivers = [];
}

/// Add to the list of receiver channels - channels that will receive IRC messages
function addToReceivers(channelObject){
	receivers.push(channelObject);
}

/// Deletes messages and sends to IRC
function uplink(message){
	if (message.channel.name == "aeolus"){
		sendToIrc(message.author.username, message.content);
		message.channel.send('**'+message.author.username+'**: '+message.content);
		message.delete();
		return true;
	}
	else{
		return false;
	}
}

/// Sends message to the IRC
function sendToIrc(authorString, messageString){
	ircUplink.sendIrcMessage(authorString+': '+messageString);
}

/// Sends a message received from the IRC
function sendFromIrc(authorString, messageString){
	for (let i = 0; i < receivers.length; i++){
		let channel = receivers[i];
		if (channel != undefined){
			sendMessage(channel, '**'+authorString+'**: '+messageString);
		}
	}
}
/// PMS welcome message to the user
function sendWelcomeMessageTo(guildMember){
	guildMember.send("Hello and Welcome to the **FAF Discord Server**. We are quite active and are happy to help with any problems you may have. \n\n__**Useful Links**__\nForums: http://forums.faforever.com/index.php \nWiki: https://wiki.faforever.com/index.php?title=Main_Page \nClient Download: https://faforever.com/client");
}

/// Replace aliases in commands
function aliasCommand(message, settings){
	if (settings.aliases != undefined && settings.aliases != null){
		const grabs = Object.keys(settings.aliases);
		let msgString = message.content;
		
		for (let i = 0; i < grabs.length; i++){	//Check if message includes one of the aliases
			const thisAlias = grabs[i];
			let validAlias = true;
			
			for (var j = 0; j < thisAlias.length; j++){
				var thisChar = msgString.charAt(j);
				var thisPrefChar = thisAlias.charAt(j);
				if (thisChar != thisPrefChar){
					validAlias = false;
				}
			}
			if (validAlias){
				message.content = settings.aliases[thisAlias] + message.content.substring(thisAlias.length);
			}
		}
	}
}

/// Executes function if prefix is found
function onPrefixFound(message, settings, utils, callback){
	for (var i = 0; i < settings.prefixes.length; i++){	//Check if message includes on of the prefixes
		const thisPref = settings.prefixes[i];
		let validPref = true;
		let command;
		for (var j = 0; j < thisPref.length; j++){
			var thisChar = message.content.charAt(j);
			var thisPrefChar = thisPref.charAt(j);
			if (thisChar != thisPrefChar){
				validPref = false;
			}
		}
		if (validPref){
			command = message.content.slice(settings.prefixes[i].length, message.content.length);	/// Removing prefix
			
			let arguments = null;
			
			if (command.indexOf(" ") > -1){
				const index = command.indexOf(" ");
				arguments = command.substring(index+1, command.length);
				command = command.substring(0, index);
			}
			
			command = command.toLowerCase();
			
			const aId = parseInt(message.author.id)		
			if (settings["dev-only-commands"].indexOf(command) > -1 && settings["devs"].indexOf(aId) < 0){
				utils.log(message.author.username+" tried to use "+command+"["+arguments+"], but is not dev. Doing nothing.", "><", message.guild);
			}
			else{
				callback(command, arguments);
				return;
			}
		}
	}
}

/// Execute command given
function executeCommand(command, arguments, cooldown, message, settings, utils, callback){
	
	if (cooldown <= 0){
	
		switch (command){
			case "respond":
			case "alive":
				sendMessage(message.channel, "Dostya is still up.")
					.then(callback(0))
					.catch(utils.log("Error while sending message", "><"));
				break;
				
		}
		
	}
	else{
		/// Will animate cooldown
		const toAnimate = ["respond", "alive"];
	}
}

function sendMessage(channel, msgString){
	if (Number.isInteger(channel)){
		channel = client.channels.get(channel);
	}
	return channel.send(msgString);
}
function startCooldown(settings, cooldownObject, id){
	cooldownObject[id] = settings.cooldown;
	setTimeout(function(){cooldownObject[id]--;}, 1000); 
}



module.exports = {
	addToReceivers:
	function(receiverChannel){
		return addToReceivers(receiverChannel);
	},
   startCooldown: 
	function(settings, cooldownObject, id){
		return startCooldown(settings, cooldownObject, id);
	},
   sendMessage: 
	function(channel, msgString){
		return sendMessage(channel, msgString);
	},
   executeCommand: 
	function(command, arguments, cooldown, message, settings, utils, callback){
		return startCooldown(command, arguments, cooldown, message, settings, utils, callback);
	},
   onPrefixFound: 
	function(message, settings, utils, callback){
		return onPrefixFound(message, settings, utils, callback);
	},
   sendWelcomeMessageTo: 
	function(guildMember){
		return sendWelcomeMessageTo(guildMember);
	},
   sendToIrc: 
	function(authorString, messageString){
		return sendToIrc(authorString, messageString);
	},
   sendFromIrc: 
	function(authorString, messageString){
		return sendFromIrc(authorString, messageString);
	},
	uplink:
	function(message){
		return uplink(message);
	},
   aliasCommand: 
	function(message, settings){
		return aliasCommand(message, settings);
	},
   cleanReceivers: 
	function(){
		return cleanReceivers();
	}
};