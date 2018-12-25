/// Libraries
const Discord = require('discord.js');
const fs = require("fs");

const client = new Discord.Client();

// Scripts
const utils = require('./scripts/utility.js');
const behavior = require('./scripts/behavior.js');

/// Configuration
const privateDir = './_private';
const tokenPath = privateDir+'/token.json';

utils.checkToken(privateDir, tokenPath);

const token = require(tokenPath);
const settings = require('./configuration/settings.json');

/// Variable initialization
let currentCooldown = {};

utils.log('Dostya launched ! Preparing...');

/// Client ready
client.on('ready', () => {
	utils.log('Dostya ready !');
	client.user.setActivity("!help");
	refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
	behavior.initializeIrc(settings);
    behavior.initializeDatabase(settings);
    behavior.initializeMapWatching(settings, client);
    behavior.initializeRss(settings);
    behavior.initializeBans(settings, client);
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
	refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
});
client.on('channelCreate', guild=>{
    if (guild.name !== undefined){
        /// If guild.name is undefined, it is very likely this "channel" is a PM channel. No need to refresh the IRC receivers in that case.
        refreshReceivers(settings, client);
        refreshAnnouncers(settings, client);
    }
});
client.on('channelDelete', guild=>{
	refreshReceivers(settings, client);
    refreshAnnouncers(settings, client);
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
	if (message.author.id === client.user.id ||
		!message.guild){
		return;
	}
	
	/// IRC transmission - if needed
    if (settings['allowed-bridges'][message.channel.name] !== undefined){
        behavior.uplink(message.channel.name, message, settings);
        return;
    }

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
				case behavior.COMMAND_SUCCESS:
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
    behavior.stopIrc(settings, "Dostya killed from terminal");
    setTimeout(function(){process.exit()}, 1000);
});

function refreshReceivers(settings, client){
    utils.log("Refreshing receivers...", "--");
	behavior.cleanReceivers();
    for (k in settings['allowed-bridges']){
        if (settings['allowed-bridges'][k].length > 0){
            for (let i = 0; i < client.guilds.array().length; i++){
                const guild = client.guilds.array()[i];
                const channel = guild.channels.find("name", k);
                if (channel != null && channel.type === "text"){
                    behavior.addToReceivers(k, channel);
                    utils.log("Added ["+guild.name+"] #"+channel.name+" to receivers", ">>", guild);
                }
            }
        }
    }
}
function refreshAnnouncers(settings, client){
    const guilds = client.guilds;
    behavior.cleanAnnouncers();
    for (const guild of guilds.values()){
        const specs = utils.getSpecifics(guild);
        const channelIds = specs['announcement-channels'];
        for (l in channelIds){
            const channelId = utils.getIdFromString(channelIds[l]);
            const channel = guild.channels.find('id', channelId);
            behavior.addToAnnouncers(channel);
            utils.log("Added ["+guild.name+"] #"+channel.name+" to announcers", ">>", guild);
        }
    }
}


client.login(token.token);
