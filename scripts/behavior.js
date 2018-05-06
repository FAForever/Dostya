///////////////////
///
/// This behavior script handles most of the bot behavior
/// 
///
///////////////////

const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require("fs");

const ircUplink = require('./irc_uplink.js');
const utils = require('./utility.js');

let receivers = [];
let lastAnimatedMessage = {};

/// On irc message received, send from IRC
ircUplink.client.addListener('message#aeolus', function (author, message) {
	utils.log("[FIRC] "+author+": "+message, "++", ircUplink.fakeGuild);
	sendFromIrc(author, message);
});

/////////////////
////
/// Execute command given
/// Main bot behavior function
///
function executeCommand(command, arguments, cooldown, message, settings, utils, callback){
	
	const cooldownWhitelist = ["respond", "alive", "unit", "searchunit", "wiki", "pool", "ladderpool", "ladder", "mappool", "ladder", "replay", "lastreplay", "clan", "player", "ratings", "searchplayer", "restrictions"];
	const developer = isDeveloper(message.author, settings);
	
	if (!developer &&  settings["dev-only-mode"]){
		utils.log(message.author.username+" tried to fire command while in dev-only mode", "!!", message.guild);
		callback(4);
	}
	else if (!developer && cooldown > 0 && cooldownWhitelist.indexOf(command) > -1){
		/// Animates cooldown
		animateCooldown(message, cooldown);
		callback(1);
	}
	else if (!developer && isDeveloperCommand(command, settings)){
		utils.log(message.author.username+" tried to fire a developer command without being dev", "!!", message.guild);
		callback(4);
	}
	else if (!developer && isRestrictedCommand(command, message.guild) && !isModerator(message.member, message.guild)){
		utils.log(message.author.username+" tried to fire a restricted command", "!!", message.guild);
		callback(4);
	}
	else if (!developer && isBlacklistedUser(message.author, message.guild)){
		utils.log(message.author.username+" tried to fire a command, but is blacklisted", "!!", message.guild);
		callback(4);
	}
	else{
		switch (command){
			default:
				callback(2);
				break;
			
			case "respond":
			case "alive":
				replyToMessage(message, "Dostya is still up.")
					.then(callback(0));
				break;
				
			case "unit":
			case "searchunit":
				if (arguments == null){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchUnitData(arguments, settings.urls.unitDB, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "wiki":
				if (arguments == null ||!utils.isAlphanumeric(arguments.replace(/ /g, ""))){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchWikiArticle(arguments, settings.urls.wiki, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "pool":
			case "ladderpool":
			case "ladder":
			case "mappool":
				fetchLadderPool(settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "replay":
			case "lastreplay":
				if (arguments == null || (command == "replay" && !utils.isNumeric(arguments))){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchReplay(command, arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "clan":
				if (arguments == null){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchClan(arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "player":
			case "ratings":
				if (arguments == null){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchPlayer(arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "searchplayer":
				if (arguments == null){
					callback(3);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchPlayerList(arguments, settings['player-search-limit'], settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(0))
				});
				break;
				
			case "help":
				sendMessage(message.author, "Consult Dostya-bot help here : \r\nhttps://github.com/FAForever/Dostya/blob/master/README.md")
				.then(callback(0));
				break;
				
			case "sendtracker":
			case "tracker":
				sendTrackerFile(message.author, message.guild)
					.then(callback(0));
				break;
				
			case "logs":
				sendBotLogs(message.author)
					.then(callback(0));
				break;
				
			case "def":		/// !def array mods @Moderators,@Admins
			case "define":
				if (arguments == null){
					callback(3);
					break;
				}
				const args = arguments.split(" ");
				if (args.length < 3){
					callback(3)
				}
				defineSpecific(message, args[0], args[1], args[2])
					.then(callback(0));
				break;
				
			case "restrict":
				if (arguments == null){
					callback(3);
					break;
				}
				restrictCommand(message.author, arguments, message.guild)
					.then(callback(0));
				break;
				
			case "unrestrict":
				if (arguments == null){
					callback(3);
					break;
				}
				unrestrictCommand(message.author, arguments, message.guild)
					.then(callback(0));
				break;
				
			case "restrictions":
				sendRestrictions(message.author, message.guild)
					.then(callback(0));
				break;
				
			case "blacklist":
				if (arguments == null){
					sendBlacklist(message.author, message.guild)
						.then(callback(0));
					break;
				}
				blacklistUser(message.author, arguments, message.guild)
					.then(callback(0));
				break;
				
			case "unblacklist":
				if (arguments == null){
					callback(3);
					break;
				}
				unblacklistUser(message.author, arguments, message.guild)
					.then(callback(0));
				break;
		}
	}
}
///
/// End of
///
///////////////

/// Checks if the function is only for developers
function isDeveloperCommand(command, settings){
	const devCmds = settings['dev-only-commands'];
	if (devCmds.indexOf(command) > -1){
		return true;
	}
	return false;
}

/// Checks if the user is a moderator on this guild
function isDeveloper(author, settings){
	const devs = settings.devs;
	if (devs.indexOf(author.id+"") > -1){
		return true;
	}
	return false;
}

/// PMs the restriction list to the user
function sendRestrictions(author, guild){
	let specs = utils.getSpecifics(guild);
	return sendMessage(author, "Current restrictions : `"+specs.restricted.join('`, `')+"`");
}

/// PMs the blacklist to the user
function sendBlacklist(author, guild){
	let specs = utils.getSpecifics(guild);
	return sendMessage(author, "Current blacklist : "+specs.blacklist.join(','));
}

/// Adds user to the blacklist
function blacklistUser(author, user, guild){
	let specs = utils.getSpecifics(guild);
	if (!isBlacklistedUser(user, guild)){
		specs.blacklist.push(user);
	}
	utils.writeSpecifics(guild, specs);
	return sendBlacklist(author, guild);
}

/// Removes user from the blacklist
function unblacklistUser(author, user, guild){
	let specs = utils.getSpecifics(guild);
	if (isBlacklistedUser(user, guild)){
		const index = specs.blacklist.indexOf(user);
		specs.blacklist.splice(index, 1);
	}
	utils.writeSpecifics(guild, specs);
	return sendBlacklist(author, guild);
}

/// Checks if the user is blacklisted on this guild
function isBlacklistedUser(author, guild){
	const specs = utils.getSpecifics(guild);
	for (let i = 0; i < specs.blacklist.length; i++){
		const thisBlacklistId = specs.blacklist[i];
		if (thisBlacklistId.search(author.id) > -1){
			return true;
		}
	}
	return false;
}

/// Checks if the user is a moderator on this guild
function isModerator(member, guild){
	const specs = utils.getSpecifics(guild);
	for (let i = 0; i < specs.mods.length; i++){
		const thisModId = specs.mods[i];
		const roles = Object.keys(member.roles);
		for (let j = 0; j < roles.length; j++){
			if (thisModId.search(role.id) > -1){
				return true;
			}
		}
	}
	return false;
}

/// Checks if a command has been restricted in that guild
function isRestrictedCommand(str_command, guild){
	const specs = utils.getSpecifics(guild);
	if (specs.restricted.indexOf(str_command) > -1){
		return true;
	}
	return false;
}

/// Restricts a command on this guild - only mods will be able to use it
function restrictCommand(author, str_command, guild){
	let specs = utils.getSpecifics(guild);
	if (!isRestrictedCommand(str_command, guild)){
		specs.restricted.push(str_command);
	}
	utils.writeSpecifics(guild, specs);
	return sendRestrictions(author, guild);
}

/// Deletes a restriction
function unrestrictCommand(author, str_command, guild){
	let specs = utils.getSpecifics(guild);
	if (isRestrictedCommand(str_command, guild)){
		const index = specs.restricted.indexOf(str_command);
		specs.restricted.splice(index, 1);
	}
	utils.writeSpecifics(guild, specs);
	return sendRestrictions(author, guild);
}

/// Defines a Specifics settings
function defineSpecific(message, property, type, data){
	let specifics = utils.getSpecifics(message.guild);
	switch (type){
		case "array":
			specifics[property] = data.split(',');
			break;
	}
	utils.writeSpecifics(message.guild, specifics);
	return sendMessage(message.author, "`"+message.guild.id+'.'+property+' set to '+data+'`');
}

/// Send the tracker file to the users on demand
function sendTrackerFile(author, guild){
	const trackerFile = utils.getTrackerFile(guild);
	if (fs.existsSync(trackerFile)){
		utils.log("Sent trackerfile to "+author.username+"", "<<");
		return author.send({ files: [new Discord.Attachment(trackerFile)] });
	}
	else{
		utils.log("No trackerfile to send to "+author.username+"", "<<");
		return sendMessage(author, "Trackerfile is empty or does not exist.");
	}
}	

/// Send the log file to the user
function sendBotLogs(author){
	const logFile = utils.getCurrentLogPath();
	if (fs.existsSync(logFile)){
		utils.log("Sent log file to "+author.username+"", "<<");
		return author.send({ files: [new Discord.Attachment(logFile)] });
	}
	else{
		utils.log("No log file to send to "+author.username+"", "<<");
		return sendMessage(author, "Logs are empty or do not exist.");
	}
}	

/// Searches for a player and returns result as a block message
function fetchPlayerList(searchTerm, limit, apiUrl, callback){
	
   utils.httpsFetch(apiUrl+'player?filter=login=="'+searchTerm+'*"&page[limit]='+(limit+1)+'', function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}
		
		const data = JSON.parse(d);
		if (data.data != undefined && data.data.length > 0){
			let finalMsg = "Search results for "+searchTerm+":\n```";
			let maxQ = limit+1;
			for (i = 0; i < Math.min(data.data.length, maxQ); i++){
				const thisPlayer = data.data[i];
				if (thisPlayer.type == "player"){
					finalMsg += thisPlayer.attributes.login+"\n";
				}
				else{
					maxQ++;
					continue;
				}
			}
			if (data.data.length > limit){
				finalMsg += '...\n\n```Only the first '+limit+" results are displayed";
			}
			else{
				finalMsg += '```';
			}
			callback(finalMsg);
		}
		else{
			callback("No results for this player name.");
		}
	});
}

/// Fetches player info and formats it as an embed message
function fetchPlayer(playerName, apiUrl, callback){
				   
   utils.httpsFetch(apiUrl+'player?filter=login=="'+playerName+'"&include=clanMemberships.clan,globalRating,ladder1v1Rating,names,avatarAssignments.avatar', function(d){
				
		const data = JSON.parse(d);
		if (data.data != undefined && data.data.length > 0){
			
			let player = {
				id : data.data[0].id,
				name : data.data[0].attributes.login,
				createTime : data.data[0].attributes.createTime,
				updateTime : data.data[0].attributes.updateTime,
				clans : [],
				aliases : [],
				avatarId : '',
				avatarUrl : '',
				lastAvatarTime: null
			}
			
			const inc = data.included;
			
			for (let i = 0; i < inc.length; i++){
				let thisData = inc[i];
				switch (thisData.type){
					default:
						continue;
						break;
						
					case "nameRecord":
						player.aliases.push(thisData.attributes.name);
						break;
					
					case "clan":	
						player.clans.push({
							name: thisData.attributes.name,
							tag: thisData.attributes.tag,
							size: thisData.relationships.memberships.data.length,
							websiteUrl: thisData.attributes.websiteUrl,
						});
						break;
					
					case "globalRating":	
						player.global = {};
						player.global.rating = thisData.attributes.rating;
						break;
					
					case "ladder1v1Rating":	
						player.ladder = {};
						player.ladder.rating = thisData.attributes.rating;
						break;
						
					case "avatarAssignment":
						if (player.lastAvatarTime < Date.parse(thisData.attributes.updateTime) && thisData.attributes.selected){
							player.avatarId = thisData.relationships.avatar.data.id;
							player.lastAvatarTime = Date.parse(thisData.attributes.updateTime);
						}
						break;
				}
			}
			
			for (let i = 0; i < inc.length; i++){
				let thisData = inc[i];
				switch (thisData.type){
					case "avatar":
						if (thisData.id == player.avatarId){
							player.avatarUrl = thisData.attributes.url.replace(/( )/g, "%20");
						}
						break;
				}
			};
			
			
			let embedMes = {
				"content": "Player info for ["+player.name+"]",
			  "embed": {
				"title": "ID : "+player.id+"",
				"color": 0xFF0000,
				"author": {
				  "name": player.name
				},
				"fields": []
			  }
			}
			
			aliasString = "None";
			
			if (player.aliases.length > 0){
				const maxAliases = 5; // max aliases
				aliasString = "";
				for (var i = 0; i < Math.min(player.aliases.length, maxAliases); i++){
					aliasString += player.aliases[i]+"\n";
				}
				if (player.aliases.length > maxAliases){
					aliasString += "...";
				}
			}
			
			embedMes["embed"].fields.push(
				  {
					"name": "Aliases",
					"value": aliasString,
					"inline": false
				  });
			
			if (player.avatarUrl != ''){
				embedMes["embed"].thumbnail = {};
				embedMes["embed"].thumbnail.url = player.avatarUrl;
			}
			
			if (player.ladder){
				embedMes["embed"].fields.push(
				  {
					"name": "Ladder rating",
					"value": ""+Math.floor(player.ladder.rating),
					"inline": true
				  });
			}
			
			if (player.global){
				embedMes["embed"].fields.push(
				  {
					"name": "Global rating",
					"value": ""+Math.floor(player.global.rating),
					"inline": true
				  });
			}
			
			if (player.clans.length > 0){
				
				for (i = 0; i < player.clans.length; i++){
					const thisClan = player.clans[i];
					embedMes["embed"].fields.push(
					  {
						"name": "Clan : "+thisClan.name+"["+thisClan.tag+"]"+"",
						"value": "Clan size : "+thisClan.size+"\n"+"URL : "+thisClan.websiteUrl,
					  });
				}
			}
		
		callback(embedMes);
		return;
	}
	else{
		callback("Requested player does not exist.");
		return;
	}
  
});
}

/// Fetches clan info and formats it as an embed message
function fetchClan(clanNameOrTag, apiUrl, callback){
	utils.httpsFetch(apiUrl+'clan?filter=name=="'+clanNameOrTag+'",tag=="'+clanNameOrTag+'"&include=memberships.player&fields[player]=login&fields[clanMembership]=createTime,player&fields[clan]=name,description,websiteUrl,createTime,tag,leader', function(d){
	if (Number.isInteger(d)){
		callback("Server returned the error `"+d+"`.");
		return;
	}
	const data = JSON.parse(d);
	
	if (data.data != undefined && data.data.length > 0){
		
		let clan = {
			id : data.data[0].id,
			name : data.data[0].attributes.name+" ["+data.data[0].attributes.tag+"]",
			createTime : data.data[0].attributes.createTime,
			description : data.data[0].attributes.description,
			websiteUrl : data.data[0].attributes.websiteUrl,
			leaderId : data.data[0].relationships.leader.data.id,
			users : {},
			leader : "Unknown"
		}
		
		const inc = data.included;
		
		for (let i = 0; i < inc.length; i++){
			let thisData = inc[i];
			switch (thisData.type){
				default:
					continue;
					break;
					
				case "player":
					if (clan.users[thisData.id] == undefined){
						clan.users[thisData.id] = {}
					}
					clan.users[thisData.id].name = (thisData.attributes.login);
					if (thisData.id == clan.leaderId){
						clan.users[thisData.id].leader = true;
					}
					else{
						clan.users[thisData.id].leader = false;
					}
					break;
					
				case "clanMembership":
					const playerId = thisData.relationships.player.data.id;
					if (clan.users[playerId] == undefined){
						clan.users[playerId] = {}
					}
					clan.users[playerId].joinedAt = utils.formattedDate(new Date(Date.parse(thisData.attributes.createTime)));
					
					break;
			}
		}
		
		if (clan.description == null || clan.description == ""){
			clan.description = "None";
		}
		
		
		let embedMes = {
			"content": "Clan info for ["+clanNameOrTag+"]",
		  "embed": {
			"title": "ID : "+clan.id+"",
			"color": 0xFF0000,
			"author": {
			  "name": clan.name,
			  "url": clan.websiteUrl
			},
			"fields": [
			{
				"name": "Created",
				"value": clan.createTime,
				"inline":true
			},
			{
				"name": "URL",
				"value": clan.websiteUrl,
				"inline":true
			},
			{
				"name": "Clan size",
				"value": Object.keys(clan.users).length,
				"inline":true
			},
			{
				"name": "Description",
				"value": clan.description,
			}
			]
		  }
		}
		
		const userArr = Object.keys(clan.users);
		if (userArr.length > 0){
			for (i = 0; i < userArr.length; i++){
				let name = clan.users[userArr[i]].name;
				let sub = clan.users[userArr[i]].joinedAt;
				if (clan.users[userArr[i]].leader === true){
					sub = "[Leader]";
				}
				
				embedMes["embed"].fields.push(
				  {
					"name": name,
					"value": sub,
					"inline": true
				  });
			}
		}
		
		callback(embedMes);
		return;
	}
	else{
		callback("Requested clan does not exist.");
		return;
	}
  
});
}

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
			
			callback(command, arguments);
				
		}
	}
}

/// Fetches an embed message about the replay given / id or playername
function fetchReplay(command, replayIdOrName, apiUrl, callback){
   
   const includes = 'include=mapVersion,playerStats,mapVersion.map,playerStats.player,featuredMod,playerStats.player.globalRating,playerStats.player.ladder1v1Rating';
   let fetchUrl = apiUrl+'game/'+replayIdOrName+'?'+includes;
   
   if (command == 'lastreplay'){
		fetchUrl = apiUrl+'game?filter=playerStats.player.login=="'+replayIdOrName+'"&sort=-endTime&page[size]=1&'+includes;
   }				   
   
   utils.httpsFetch(fetchUrl, function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}
		const data = JSON.parse(d);
		
		if (data != undefined && data.data != undefined && (
				(Array.isArray(data.data) && data.data.length > 0) || data.data.attributes != undefined)								
			){
			
			if (command == 'lastreplay'){
				data.data = data.data[0];
			}
			
			let replay = {
				id : replayIdOrName,
				name : data.data.attributes.name,
				replayUrl : data.data.attributes.replayUrl.replace(/( )/g, "%20"),
				startTime : data.data.attributes.startTime,
				victoryCondition : data.data.attributes.victoryCondition,
				validity : data.data.attributes.validity,
				gameType: "",
				technicalGameType: "",
				imgUrl: "",
				mapName: "",
				mapVersion: "",
				mapType: "",
				mapSize: "",
				players: {},
				ranked:false
			}
			
			const inc = data.included;
			
			for (let i = 0; i < inc.length; i++){
				let thisData = inc[i];
				switch (thisData.type){
					default:
						continue;
						break;
						
					case "mapVersion":
						replay.imgUrl = thisData.attributes.thumbnailUrlSmall.replace(/( )/g, "%20");
						replay.mapVersion = thisData.attributes.version;
						replay.mapSize = ((thisData.attributes.width/512)*10)+"x"+((thisData.attributes.height/512)*10)+" km";
						replay.ranked = thisData.attributes.ranked;
						break;
						
					case "map":
						replay.mapName = thisData.attributes.displayName;
						replay.mapType = thisData.attributes.mapType;
						break;
						
					case "gamePlayerStats":
						const gpsid = thisData.relationships.player.data.id;
						if (replay.players[gpsid] == undefined){
							replay.players[gpsid] = {};
						}
						replay.players[gpsid].slot = thisData.attributes.startSpot;
						replay.players[gpsid].score = thisData.attributes.score;
						replay.players[gpsid].faction = thisData.attributes.faction;
						replay.players[gpsid].ai = thisData.attributes.ai;
						replay.players[gpsid].team = thisData.attributes.team;
						break;
					
					case "player":
						const pid = thisData.id;
						if (replay.players[pid] == undefined){
							replay.players[pid] = {};
						}
						replay.players[pid].name = thisData.attributes.login;
					
						break;
						
					case "featuredMod":
						switch (thisData.attributes.technicalName){
							default:
								replay.gameType = thisData.attributes.displayName;
								replay.technicalGameType = thisData.attributes.technicalName;
								break;
								
							case "faf":
								break;
						}
						break;
						
					case "ladder1v1Rating":
						const lid = thisData.relationships.player.data.id;
						replay.players[lid].ladderRating = Math.floor(thisData.attributes.rating);
						break;
						
					case "globalRating":
						const gid = thisData.relationships.player.data.id;
						replay.players[gid].globalRating = Math.floor(thisData.attributes.rating);
						
						break;
				}
			}
			
			let gm = replay.gameType;
			if (replay.gameType != ""){
				gm = "["+gm+"] ";
			}
			
			let embedMes = {
			  "embed": {
				"title": "**Download replay #"+replay.id+"**",
				"url": replay.replayUrl,
				"color": 0xFF0000,
				"thumbnail": {
				  "url": replay.imgUrl
				},
				"author": {
				  "name": gm+replay.name,
				  "url": replay.replayUrl,
				},
				"fields": [
				  {
					"name": "Start time",
					"value": replay.startTime,
					"inline": true
				  },
				  {
					"name": "Victory Condition",
					"value": replay.victoryCondition,
					"inline": true
				  },
				  {
					"name": "Validity",
					"value": replay.validity,
					"inline": true
				  },
				  {
					"name": "Ranked",
					"value": replay.ranked.toString(),
					"inline": true
				  },
				  {
					"name": "Map info",
					"value": replay.mapName+" ["+replay.mapVersion+"] ("+replay.mapSize+")"
				  }
				]
			  }
			}
			
			const keys = Object.keys(replay.players);
			for (let i = 0; i < keys.length; i++){
				const id = keys[i];
				const p = replay.players[id];
				
				let rating = "0";
				
				if (replay.technicalGameType == "ladder1v1"){
					rating = "L"+p.ladderRating;
				}
				else{
					rating = "G"+p.globalRating;
				}
				
				let pNameString = ""+utils.getFaction(p.faction).substring(0, 1).toUpperCase()+" - "+p.name+" ["+rating+"]";
				
				let value = "";
				
				if (!replay.validity.includes("FFA")){
					value += "Team "+p.team+"\n";
				}
				
				value += "Score: "+p.score+"\n";
				if (p.ai){
					pNameString = "AI "+pNameString;
				}
				
				embedMes["embed"].fields.push({"name":pNameString, "value": value, "inline": true});
				
			}
			
			callback(embedMes);
			return;
		}
		else{
			callback("Replay not found.");
			return;
		}
	  
   });
}

function fetchLadderPool(apiUrl, callback){
					
	utils.httpsFetch(apiUrl+'ladder1v1Map?include=mapVersion.map', function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}
		
		const data = JSON.parse(d);
		if (data != undefined && data.included != undefined){
			
			let maps = {};
			const inc = data.included;
				
			for (let i = 0; i < inc.length; i++){
				let thisData = inc[i];
				let id = "";
				switch (thisData.type){
					default:
						continue;
						break;
						
					case "mapVersion":
						id = thisData.relationships.map.data.id;
						if (maps[id] == undefined){
							maps[id] = {};
						}
						
						maps[id].imgUrl = thisData.attributes.thumbnailUrlSmall.replace(/( )/g, "%20");
						maps[id].mapVersion = thisData.attributes.version;
						maps[id].mapSize = ((thisData.attributes.width/512)*10)+"x"+((thisData.attributes.height/512)*10)+" km";
						break;
						
					case "map":
						id = thisData.id;
						if (maps[id] == undefined){
							maps[id] = {};
						}
						maps[id].mapName = thisData.attributes.displayName;
						
						break;
				}
			}
			
			let embedMes = {
				  "embed": {
					"title": "**Ladder maps pool**",
					"color": 0xFF0000,
					"thumbnail": {
					  "url": maps[Object.keys(maps)[0]].imgUrl
					},
					"fields": []
				  }
				}
				
				const keys = Object.keys(maps);
				for (let i = 0; i < keys.length; i++){
					const id = keys[i];
					const m = maps[id];
					
					embedMes["embed"].fields.push({
						"name": m.mapName+" ["+m.mapVersion+"]",
						"value": m.mapSize,
						"inline": true
					});
				}
				
				callback(embedMes);
				return;
			
		}
		else{
			callback("Could not retrieve map pool.");
			return;
		}
		  
	});
}
function escapeArguments(str){
	str = str.replace(/\\/g, "\\\\")
   .replace(/\$/g, "\\$")
   .replace(/'/g, "\\'")
   .replace(/"/g, "\\\"");
   return str;
}
function fetchWikiArticle(searchTerm, wikiUrl, callback){
	
	utils.httpsFetch(wikiUrl+'api.php?action=query&list=search&srsearch='+searchTerm+'&format=json&srlimit=1&srwhat=title', function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}
		
		const data = JSON.parse(d);
		if (data != undefined && data.query != undefined && data.query.searchinfo.totalhits > 0){
			
			const hit = data.query.search[0]; //For multiple results, will have to tweak this in a for loop.
			
			let embedMes = {
				"content": "Results for search term \""+searchTerm+"\" :",
				  "embed": {
					"title": "**Click here to access wiki page**",
					"url": wikiUrl+"index.php?title="+hit.title.replace(/( )/g, "%20")+"",
					"color": 0xFF0000,
					"thumbnail": {
					  "url": wikiUrl+"images/icon.png"
					},
					"fields": [
					  {
						"name": ""+hit.title+"",
						"value": hit.snippet.replace(/<{1}[^<>]{1,}>{1}/g,"")
					  }
					]
				  }
				};
			
			callback(embedMes);
		}
		
		else{
			callback("No results for the term \""+searchTerm+"\"");
			return;
		}
		
	});
}
function fetchUnitData(unitID, dbAddress, callback){
	//Character escaping
   const webAddress = dbAddress;
	
	utils.httpFetch(webAddress+'api.php?searchunit='+unitID+'', function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}
		
		const data = JSON.parse(d);
		
		if (data != undefined && data.BlueprintType != undefined && data.BlueprintType == "UnitBlueprint"){
			
			////NAME FORMAT
			let cuteName = '';
			if (data.General.UnitName != undefined){
				cuteName = '"'+data.General.UnitName.replace(/<{1}[^<>]{1,}>{1}/g,"")+'" ';
			}
			
			
			let unit ={
				id: data.Id,
				name: ''+cuteName+''+data.Description.replace(/<{1}[^<>]{1,}>{1}/g,""),
				previewUrl: webAddress+'res/img/preview/'+data.Id+'.png',
				strategicUrl: webAddress+'res/img/strategic/'+data.StrategicIconName+'_rest.png',
				faction: data.General.FactionName,
			}
			
			let embedMes = {
				  "embed": {
					"title": "**Click here to open unitDB**",
					"description":""+unit.faction+" - "+unit.id, // <:"+(unit.faction.toLowerCase())+":"+message.client.emojis.findKey("name",(unit.faction.toLowerCase()))+">
					"url": webAddress+'index.php?id='+unit.id,
					"color": utils.getFactionColor(unit.faction),
					"thumbnail": {
					  "url": unit.previewUrl
					},
					"author": {
					  "name": unit.name,
					  "url": webAddress+'index.php?id='+unit.id,
						"icon_url": unit.strategicUrl
					},
					"fields": [
					]
				  }
				}
			callback(embedMes);
			
		}
		else{
			callback("Unit not found");
			return;
		}
	});
}

/// Reacts with a little W A I T on the last command that couldn't be fired because of cooldown
function animateCooldown(message, cooldown){
	if (lastAnimatedMessage.react != undefined){
		lastAnimatedMessage.clearReactions();
	}
	message.react("🇼")
	.then(() => message.react("🇦"))
	.then(() => message.react("🇮"))
	.then(() => message.react("🇹"));
	lastAnimatedMessage = message;
}

/// Sends message to the channel
function sendMessage(channel, msgContent){
	let canSend = true;
	
	if (Number.isInteger(channel)){
		channel = client.channels.get(channel);
	}
	
	if (channel instanceof Discord.Channel){
		const myPermissions = channel.permissionsFor(channel.guild.me);
		canSend = myPermissions.has('SEND_MESSAGES');
	}
	
	if (canSend){
		utils.log("Sent message "+msgContent+" on "+channel.toString()+"", "DD", channel.guild);
		return channel.send(msgContent);
	}
	return utils.emptyPromise();
}

/// Replies to existing message
function replyToMessage(message, msgContent){
	const myPermissions = message.channel.permissionsFor(message.guild.me);
	if (myPermissions.has('SEND_MESSAGES')){
		utils.log("Sent as a reply message "+msgContent+" on "+message.toString()+"", "DD", message.guild);
		return message.reply(msgContent);
	}
	return utils.emptyPromise();
}

/// Starts the cooldown timer
function startCooldown(settings, cooldownObject, id){
	if (cooldownObject == null){
		cooldownObject = {};
	}
	
	const maxCd = settings.cooldown;
	cooldownObject[id] = maxCd;
	
	setTimeout(function(){
		refreshCooldown(id, cooldownObject);
	}, 1000); 
}

// Actualizes the cooldown timer
function refreshCooldown(id, cooldownObject){
	
	cooldownObject[id]--;
	if (cooldownObject[id] > 0){
		setTimeout(function(){
			refreshCooldown(id, cooldownObject);
		}, 1000); 
	}
}


module.exports = {
	addToReceivers:
	function(receiverChannel){
		return addToReceivers(receiverChannel);
	},
   startCooldown: 
	function(settings, cooldownObject, guildId){
		return startCooldown(settings, cooldownObject, guildId);
	},
   sendMessage: 
	function(channel, msgString){
		return sendMessage(channel, msgString);
	},
   executeCommand: 
	function(command, arguments, cooldown, message, settings, utils, callback){
		return executeCommand(command, arguments, cooldown, message, settings, utils, callback);
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