//LIBS
const Discord = require('discord.js');
const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();

const client = new Discord.Client();
module.exports = {
   getChannel: function(str){	return client.channels.get(str);}
}

//UTILS
const utils = require('./utils/funcs.js');
const behavior = require('./utils/reactions.js');
const ircu = require('./utils/irc_uplink.js');

//CONFIG
const config = require('./_private/config.json');
const settings = require('./sys/settings.json');
const databaseFile = './_private/userdata.db';  
let db = new sqlite3.Database(databaseFile);  

let onCooldown = false;

utils.log('Dostya fired ! Preparing...');

//INITIALIZATION
client.on('ready', () => {
	utils.log('Dostya ready !');
	//client.user.setActivity(`with the Seven Hand Node.`);
});

//ON ERROR
client.on('error', function(err){
	utils.log('Dostya encountered an error: '+err.message, 'WW');
});

//ON DISCONNECT
client.on('disconnect', () => {
  utils.log('Dostya has disconnected', 'WW');
});

//ON GUILD MEMBER ADD
client.on('guildMemberAdd', guildMember=>{
	utils.log('User "'+guildMember.user.username+'" joined the guild', 'TR', guildMember.guild);
	utils.track(guildMember);

	//Drop a message for the new users.
	//let channel = client.channels.get("273508471834542091");
	//channel.send(`Welcome ${guildMember.toString()}! Feel free to introduce yourself to the community. :slight_smile:`);

	guildMember.send("Hello and Welcome to the **FAF Discord Server**. We are quite active and are happy to help with any problems you may have. \n\n__**Useful Links**__\nForums: http://forums.faforever.com/index.php \nWiki: https://wiki.faforever.com/index.php?title=Main_Page \nClient Download: https://faforever.com/client");
});

//ON MESSAGE
client.on('message', message => {
	//it's me !
	if (message.author.id == client.user.id){
		return;
	}
	
	//Aeolus transmission
	if (message.channel.name == "aeolus"){
		ircu.sendIrcMessage(message.author.username+': '+message.content);
		message.channel.send('**'+message.author.username+'**: '+message.content);
		message.delete();
		return;
	}
	
	
	//SAFETY
	if (!message.guild){
		utils.log('Received message from empty guild. Doing nothing.', '><');
		return;
	}
	
	let msgString = message.content;
	let issuedCommand = false;
	let talkingToMe = false;
	
	//////////////////////
	// INPUT DETECTION
	//////////////////////

	if (settings.aliases != undefined && settings.aliases != null){
		const grabs = Object.keys(settings.aliases);
		
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
				utils.log('Aliased '+msgString+' in '+message.content+' for command recognition - should be talking to me', '??', message.guild);
				msgString = message.content;
			}
		}
	}
		
	for (var i = 0; i < settings.prefixes.length; i++){	//Check if message includes on of the prefixes
		const thisPref = settings.prefixes[i];
		let validPref = true;
		for (var j = 0; j < thisPref.length; j++){
			var thisChar = msgString.charAt(j);
			var thisPrefChar = thisPref.charAt(j);
			if (thisChar != thisPrefChar){
				validPref = false;
			}
		}
		if (validPref){
			utils.log(message.author.username+' is talking to me', '!!', message.guild);
			message.content = message.content.slice(settings.prefixes[i].length, message.content.length);
			talkingToMe = true;
			break;
		}
	}
	if (talkingToMe){	//It does => Execing command
		  //Exit if on cooldown
		if (onCooldown){
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
					utils.log("...nothing to respond to that", "><", message.guild);
				}
				else if (result === true){
					issuedCommand = true;
					utils.log("...end of interaction", "OK", message.guild);
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
		onCooldown = true;
		setTimeout(function(){onCooldown = false;}, 30000);
	}
});


//ON EXCEPTION
process.on('uncaughtException', function(err) {
  utils.log('-------------------------', 'XX');
  utils.log('CRASH AVOIDED! ' + err, 'XX');
  console.log(err);
  utils.log('-------------------------', 'XX');
});


client.login(config.token);
