//LIBS
const fs = require("fs");
const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const http = require('http');

//UTILS
const utils = require('./funcs.js');
const databaseFile = './_private/userdata.db';  
const trackerfile = './_private/tracker.txt';
let db = new sqlite3.Database(databaseFile);  

//CONFIG
const settings = require('../sys/settings.json');

const Attachment = require('discord.js').Attachment;

//EXPORTS AT EOF

////////////////
/// REACT FUNCTION
////////////////

function react(message, callBack){
	let msgString = message.content;
	let argument = null;
	
	if (msgString.indexOf(" ") > -1){
		const index = msgString.indexOf(" ");
		argument = msgString.substring(index+1, msgString.length);
		msgString = msgString.substring(0, index);
		utils.log("...after argument removal, reacting to "+msgString+"["+argument+"]...", "..", message.guild);
	}
	//Commands made more easy
	msgString = msgString.toLowerCase();
	//endof
	
	const aId = parseInt(message.author.id)		
	if (settings["dev-only-commands"].indexOf(msgString) > -1 && settings["devs"].indexOf(aId) < 0){
		
		utils.log(message.author.username+" tried to use dev command, but is not dev. Doing nothing.", "><", message.guild);
		callBack(sendMessage(message.channel, "<@"+message.author.id+"> This is a dev-only command. Doing nothing."));
		return;
	}
	
	else{
	
		switch (msgString){
			default:
				callBack(null); //null => nothing happened
				break;
				
			case "unit":
				utils.log(message.author.username+" is performing an unitDB search...", "..", message.guild);
				//Character escaping
				argument = argument.replace(/\\/g, "\\\\")
			   .replace(/\$/g, "\\$")
			   .replace(/'/g, "\\'")
			   .replace(/"/g, "\\\"");
			   
			   const webAddress = "http://direct.faforever.com/faf/unitsDB/";
				
				httpFetch(webAddress+'api.php?searchunit='+argument+'', function(d){
					if (Number.isInteger(d)){
						callBack(sendMessage(message.channel, "Server returned the error `"+d+"`."));
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
							economy : data.Economy,
							hp: data.Defense.Health,
							regen: data.Defense.RegenRate,
							faction: data.General.FactionName,
							abilities: data.Display.Abilities
						}
						
						let embedMes = {
							  "embed": {
								"title": "**Click here to open unitDB**",
								"description":"<:"+(unit.faction.toLowerCase())+":"+message.client.emojis.findKey("name",(unit.faction.toLowerCase()))+"> "+unit.faction+" - "+unit.id,
								"url": webAddress+'index.php?id='+unit.id,
								"color": getFactionColor(unit.faction),
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
						callBack(sendMessage(message.channel, embedMes));
						return;
						
					}
					else{
						utils.log("...no results. EOI.", "><", message.guild);
						callBack(sendMessage(message.channel, "Unit not found"));
						return;
					}
				});
				break;
				
			case "wiki":
				if (argument == null || argument.length == 0 || !isAlphanumeric(argument.replace(/ /g, ""))){
					//empty search
					callBack(false);
					return;
				}
				utils.log(message.author.username+" is performing a wiki search...", "..", message.guild);
					//Character escaping
					argument = argument.replace(/\\/g, "\\\\")
				   .replace(/\$/g, "\\$")
				   .replace(/'/g, "\\'")
				   .replace(/"/g, "\\\"");
				
				httpsFetch('https://wiki.faforever.com/api.php?action=query&list=search&srsearch='+argument+'&format=json&srlimit=1&srwhat=title', function(d){
					if (Number.isInteger(d)){
						callBack( sendMessage(message.channel, "Server returned the error `"+d+"`."));
						return;
					}
					
					const data = JSON.parse(d);
					if (data != undefined && data.query != undefined && data.query.searchinfo.totalhits > 0){
						utils.log("....search hit ! Retrieving data...", "..", message.guild);
						
						const hit = data.query.search[0]; //For multiple results, will have to tweak this in a for loop.
						
						let embedMes = {
							"content": "Results for search term \""+argument+"\" :",
							  "embed": {
								"title": "**Click here to access wiki page**",
								"url": "https://wiki.faforever.com/index.php?title="+hit.title.replace(/( )/g, "%20")+"",
								"color": 0xFF0000,
								"thumbnail": {
								  "url": "https://wiki.faforever.com/images/icon.png"
								},
								"fields": [
								  {
									"name": ""+hit.title+"",
									"value": hit.snippet.replace(/<{1}[^<>]{1,}>{1}/g,"")
								  }
								]
							  }
							};
						
						callBack(sendMessage(message.channel, embedMes));
						return;
					}
					
					else{
						utils.log("...no results. EOI.", "><", message.guild);
						callBack(sendMessage(message.channel, "No results for the term \""+argument+"\""));
						return;
					}
					
				});
				break;
				
			case "pool":
			case "ladderpool":
			case "ladder":
				utils.log(message.author.username+" is asking info about FAF pool...", "..", message.guild);
				httpsFetch('https://api.faforever.com/data/ladder1v1Map?include=mapVersion.map', function(d){
					if (Number.isInteger(d)){
						callBack( sendMessage(message.channel, "Server returned the error `"+d+"`."));
						return;
					}
					
					const data = JSON.parse(d);
					if (data != undefined && data.included != undefined){
						utils.log("....found map pool ! Retrieving data...", "..", message.guild);
						
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
							
							callBack( sendMessage(message.channel, embedMes));
							return;
						
					}
					else{
						utils.log("...error fetching map pool info!", "><", message.guild);
						callBack(sendMessage(message.channel, "Could not retrieve map pool."));
						return;
					}
					  
				   });
					callBack(true);
					return;
				break;
				
			case "replay":
			case "lastreplay":
				if (argument == null || (msgString == "replay" && !isNumeric(argument))){
					//utils.log(message.author.username+" command misuse, doing nothing.", "><", message.guild);
					callBack(false);
					return;
				}
				else{
					
					utils.log(message.author.username+" is asking info about FAF Replay ["+argument+"]...", "..", message.guild);
					//Character escaping
					argument = argument.replace(/\\/g, "\\\\")
				   .replace(/\$/g, "\\$")
				   .replace(/'/g, "\\'")
				   .replace(/"/g, "\\\"");
				   
				   const includes = 'include=mapVersion,playerStats,mapVersion.map,playerStats.player,featuredMod,playerStats.player.globalRating,playerStats.player.ladder1v1Rating';
				   let fetchUrl = 'https://api.faforever.com/data/game/'+argument+'?'+includes;
				   
				   if (msgString == 'lastreplay'){
						fetchUrl = 'https://api.faforever.com/data/game?filter=playerStats.player.login=="'+argument+'"&sort=-endTime&page[size]=1&'+includes;
				   }				   
				   
				   httpsFetch(fetchUrl, function(d){
						if (Number.isInteger(d)){
							callBack(sendMessage(message.channel, "Server returned the error `"+d+"`."));
							return;
						}
						const data = JSON.parse(d);
						
						if (data != undefined && data.data != undefined && (
								(Array.isArray(data.data) && data.data.length > 0) || data.data.attributes != undefined)								
							){
							utils.log("....found replay ! Retrieving data...", "..", message.guild);
							
							if (msgString == 'lastreplay'){
								data.data = data.data[0];
							}
							
							let replay = {
								id : argument,
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
								
								let pNameString = "<:"+getFaction(p.faction)+":"+message.client.emojis.findKey("name",getFaction(p.faction))+"> "+p.name+" ["+rating+"]";
								
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
							
							callBack(sendMessage(message.channel, embedMes));
							return;
						}
						else{
							utils.log("...non-existing replay!", "><", message.guild);
							callBack(sendMessage(message.channel, "Replay not found."));
							return;
						}
					  
				   });
					callBack(true);
					return;
				}
			
				break;
				
			case "clan":
				if (argument == null){
					//utils.log(message.author.username+" command misuse, doing nothing.", "><", message.guild);
					callBack(false);
					return;
				}
				else{
					utils.log(message.author.username+" is asking info about FAF clan ["+argument+"]...", "..", message.guild);
					//Character escaping
					argument = argument.replace(/\\/g, "\\\\")
				   .replace(/\$/g, "\\$")
				   .replace(/'/g, "\\'")
				   .replace(/"/g, "\\\"");
				   
					
				   //Single HTTPS-GET should get us everything we need
				   httpsFetch('https://api.faforever.com/data/clan?filter=name=="'+argument+'",tag=="'+argument+'"&include=memberships.player&fields[player]=login&fields[clanMembership]=createTime,player&fields[clan]=name,description,websiteUrl,createTime,tag,leader', function(d){
						if (Number.isInteger(d)){
							callBack(sendMessage(message.channel, "Server returned the error `"+d+"`."));
							return;
						}
						const data = JSON.parse(d);
						
						if (data.data != undefined && data.data.length > 0){
							utils.log("....found clan ! Retrieving data...", "..", message.guild);
							
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
										clan.users[playerId].joinedAt = formattedDate(new Date(Date.parse(thisData.attributes.createTime)));
										
										break;
								}
							}
							
							if (clan.description == null || clan.description == ""){
								clan.description = "None";
							}
							
							
							let embedMes = {
								"content": "Clan info for ["+argument+"]",
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
							
							utils.log("...retrieved and returned full data in the guild.", "OK", message.guild);
							callBack(sendMessage(message.channel, embedMes));
							return;
						}
						else{
							utils.log("...non-existing clan!", "><", message.guild);
							callBack(sendMessage(message.channel, "Requested clan do not exist."));
							return;
						}
					  
				   });
					callBack(true);
				}
				break;
				
			case "searchplayer":
				if (argument == null){
					callBack(false);
					return;
				}
				else{
					utils.log(message.author.username+" is performing an user search with term ["+argument+"]...", "..", message.guild);
					const limit = 5;	//Only 5 results
					//Character escaping
					argument = argument.replace(/\\/g, "\\\\")
				   .replace(/\$/g, "\\$")
				   .replace(/'/g, "\\'")
				   .replace(/"/g, "\\\"");
				   
				   
				   httpsFetch('https://api.faforever.com/data/player?filter=login=="'+argument+'*"&page[limit]='+(limit+1)+'', function(d){
						if (Number.isInteger(d)){
							callBack(sendMessage(message.channel, "Server returned the error `"+d+"`."));
							return;
						}
						
						const data = JSON.parse(d);
						if (data.data != undefined && data.data.length > 0){
							let finalMsg = "Search results for "+argument+":\n```";
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
								finalMsg += '...\n```Only the first '+limit+" results are displayed";
							}
							else{
								finalMsg += '```';
							}
							utils.log("...retrieved and returned full data in the guild.", "OK", message.guild);
							callBack(sendMessage(message.channel, finalMsg));
							return;
						}
						else{
							utils.log("...no results!", "><", message.guild);
							callBack(sendMessage(message.channel, "No results for this player name."));
							return;
						}
					});
				}
				break;
				
				
			case "player":
				if (argument == null){
					//utils.log(message.author.username+" command misuse, doing nothing.", "><", message.guild);
					
					callBack(false);
					return;
				}
				else{
					utils.log(message.author.username+" is asking info about FAF Player ["+argument+"]...", "..", message.guild);
					
					//Character escaping
					argument = argument.replace(/\\/g, "\\\\")
				   .replace(/\$/g, "\\$")
				   .replace(/'/g, "\\'")
				   .replace(/"/g, "\\\"");
				   ///end of
				   
				   httpsFetch('https://api.faforever.com/data/player?filter=login=="'+argument+'"&include=clanMemberships.clan,globalRating,ladder1v1Rating,names,avatarAssignments.avatar', function(d){
								
						const data = JSON.parse(d);
						if (data.data != undefined && data.data.length > 0){
							utils.log("....found player ! Retrieving data...", "..", message.guild);
							
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
							
							utils.log("...retrieved and returned full data in the guild.", "OK", message.guild);
							callBack(sendMessage(message.channel, embedMes));
							return;
						}
						else{
							utils.log("...non-existing player!", "><", message.guild);
							callBack(sendMessage(message.channel, "Requested player do not exist."));
							return;
						}
					});
					callBack(true);
					return;
				}
				break;
				
			case "sendtracker":
				if (fs.existsSync(trackerfile)){
					message.author.send({ files: [new Attachment(trackerfile)] });
					utils.log("Sent trackerfile to "+message.author.username+"", "--", message.guild);
					callBack(true);
					return;
				}
				else {
					sendMessage(message.author, "No trackerfile to send!");
					utils.log("No trackerfile to send to "+message.author.username+"", "--", message.guild);
					callBack(true);
					return;
				}
				break;
		/*	
			case "addpoints":
				if (argument == null){
					callBack(false);
					return;
				}
				else{
					//Determining user amount
					let pointsToGive = 0;
					let usersToGive = [];
					
					const argArr = argument.split(" ");
					
					if (argArr.length > 0){
						pointsToGive = argArr[0];
					}
					let replyList = [];
					if (argArr.length > 1){
						for (let i = 1; i < argArr.length; i++){
							thisUserId = utils.replyToId(argArr[i]);
							usersToGive.push(thisUserId);
							replyList.push(argArr[i]);
						}
					}
					addPoints(db, usersToGive, parseFloat(pointsToGive), function(){
						sendMessage(message.channel, "Added "+(pointsToGive)+" points to "+replyList.join(" ")+"");
					});
					callBack(true);
					return;
				}
				break;
				
			case "getpoints":
			case "level":
				let id = 0;
				if (argument == null){
					id = message.author.id;
				}
				else{
					id = utils.replyToId(argument);
				}
				getPoints(db, id, function(int_points){
					sendMessage(message.channel, "<@"+id+"> has "+int_points+" points");
				});
				
				callBack(true);
				return;
				
				break;
			
			case "setpoints":
				if (argument == null){
					setPoints(db, message.author.id, 0, function(){
							sendMessage(message.channel, "Reset points for "+message.author.username+"");
						});
				}
				else{
					//Determining user amount
					let pointsToGive = 0;
					let usersToGive = [];
					
					const argArr = argument.split(" ");
					
					if (argArr.length > 0){
						pointsToGive = argArr[0];
					}
					if (argArr.length > 1){
						for (let i = 1; i < argArr.length; i++){
							thisUserId = utils.replyToId(argArr[i]);
							usersToGive.push(thisUserId);
						}
					}
					setPoints(db, usersToGive, pointsToGive, function(){
						let userDisplayList = [];
						for (let i = 0; i < usersToGive.length; i++){
							userDisplayList.push("<@"+usersToGive[i]+">")
						}
						if (usersToGive.length <= 0){
							sendMessage(message.channel, "Set points to "+pointsToGive+" every user")
						}
						else{
							sendMessage(message.channel, "Set "+pointsToGive+" points to "+userDisplayList.join(" "))
						}
					});
				}
				
				callBack(true);
				return;
				break;
			*/
			case "respond":
			case "alive":
				callBack(respond(message, "Dostya is still up.", message.author));
				return;
				break;
			case "help":
				callBack(sendMessage(message.author, "Consult Dostya-bot help here : \r\nhttps://github.com/FAForever/Dostya/blob/master/README.md"));
				break;
		}
	}
}
////////////
///	MAIN BOT BEHAVIOR
////////////
function respond(oMessage, rspMsgString, author=null){
	let string = rspMsgString;
	oMessage.reply(string);
	return true;
}
function sendMessage(channel, msgString){
	if (Number.isInteger(channel)){
		channel = client.channels.get(channel);
	}
    channel.send(msgString);
	return true;
}
function addPoints (database, userList, int_points, function_callback){
	for (let i = 0; i < userList.length; i++){
		let fakeList = [];
		fakeList.push(userList[i]);
		if (i == userList.length-1){
			getPoints(database, userList[i], function(pointsStock){
				if (!isNaN(int_points)){
					setPoints(database, fakeList, pointsStock+int_points, function(){
						function_callback()});
				}
				else{
					utils.log("Error while adding "+int_points+" to user "+userList[i]+"", "><");
				}
			});
		}
		else{
			getPoints(database, userList[i], function(pointsStock){
				if (!isNaN(int_points)){
					setPoints(database, fakeList, pointsStock+int_points, function(){});
				}
				else{
					utils.log("Error while adding "+int_points+" to user "+userList[i]+"", "><");
				}
			});
		}
	}
}
function setPoints(database, userList, int_points, function_callback){
	
	database.run("CREATE TABLE IF NOT EXISTS users (`id` INT PRIMARY KEY NOT NULL, `points` INT)", function(){
		//Now database exists
		if (userList.length <= 0){
			database.all("UPDATE users SET `points`="+int_points, function(err, rows) {
				if (err){
					utils.log(err, '><');
				}
				function_callback();
			});   
		}
		else{
			for (let i = 0; i < userList.length; i++){
				const request = 'INSERT INTO users (`id`, `points`) VALUES('+userList[i]+', 0)';
				database.all(request, function(err) {
					/*
					utils.log(request, '><');
					utils.log(err, '><');
					*/
					//Now row exists
					if (i == userList.length-1){
						database.all("UPDATE users SET `points`="+int_points+" WHERE `id`="+userList[i], function(err, rows) {
							if (err){
								utils.log(err, '><');
							}
						}, function(){ function_callback();});  
					}
					else{
						database.all("UPDATE users SET `points`="+int_points+" WHERE `id`="+userList[i], function(err, rows) {
							if (err){
								utils.log(err, '><');
							}
						});  
					}					
				});
			}
		}
	});
}

function getPoints(database, userId, function_callback){
	database.run("CREATE TABLE IF NOT EXISTS users (`id` INT PRIMARY KEY NOT NULL, `points` INT)", function(){
		//Now database exists
		
		database.run('INSERT INTO users (`id`, `points`) VALUES ('+userId+', 0)', function() {
			//Now row exists
			database.get('SELECT `points` FROM users WHERE id='+userId, function(err, row) {
				if (err){
					utils.log(err, '><');
				}
				if (row == undefined){
					return;
				}
				function_callback(row.points);
			});   
		});
	});
}

function httpsFetch(address, function_callback){
   
   //Single HTTPS-GET should get us everything we need
   
	https.get(address, (res) => {
		//console.log('statusCode:', res.statusCode);
		//console.log('headers:', res.headers);
		let ok = false;
		switch (res.statusCode){
			default:
				ok = true;
				break;
				
			case 400:
				utils.log("Malformed request ?! 400 - doing nothing.", "WW");
				break;
				
			case 403:
				utils.log("Access forbidden ?! 403 - doing nothing.", "WW");
				break;
				
			case 404:
				utils.log("Server not found ?! 404 - doing nothing.", "WW");
				break;
				
			case 500:
				utils.log("Server error ?! 505 - doing nothing.", "WW");
				break;
		}
		
		if (ok){

			let d = '';

			res.setEncoding('utf8');

			res.on('readable', function () {
				const chunk = this.read() || '';

				d += chunk;
			});

			res.on('end', function () { function_callback(d); });
			
		}
		else{
			function_callback(res.statusCode);
		}
		
	}).on('error', (e) => {
		utils.log("HTTPS request returned following error : ["+(e)+"]. Doing nothing.", "WW");
	});
}
function httpFetch(address, function_callback){
	
	http.get(address, (res) => {
		//console.log('statusCode:', res.statusCode);
		//console.log('headers:', res.headers);
		let ok = false;
		switch (res.statusCode){
			default:
				ok = true;
				break;
				
			case 400:
				utils.log("Malformed request ?! 400 - doing nothing.", "WW");
				break;
				
			case 403:
				utils.log("Access forbidden ?! 403 - doing nothing.", "WW");
				break;
				
			case 404:
				utils.log("Server not found ?! 404 - doing nothing.", "WW");
				break;
				
			case 500:
				utils.log("Server error ?! 505 - doing nothing.", "WW");
				break;
		}
		
		if (ok){

			let d = '';

			res.setEncoding('utf8');

			res.on('readable', function () {
				const chunk = this.read() || '';

				d += chunk;
			});

			res.on('end', function () { function_callback(d); });
			
		}
		else{
			function_callback(res.statusCode);
		}
		
	}).on('error', (e) => {
		utils.log("HTTP request returned following error : ["+(e)+"]. Doing nothing.", "WW");
	});
}

function getFaction(int_fac){
	switch (int_fac){
		default:
			return false;
			break;
			
		case 1:
			return "uef"
			break;
		case 2:
			return "aeon"
			break;
		case 3:
			return "cybran"
			break;
		case 4:
			return "seraphim"
			break;
		case 5:
			return "nomad"
			break;
	}
}
function getFactionColor(str_fac){
	
	switch (str_fac.toLowerCase()){
			
		case "uef":
			return 0x0000FF;
			break;
		case "aeon":
			return 0x00FF00;
			break;
		case "cybran":
			return 0xFF0000;
			break;
		case "seraphim":
			return 0xFFFF00;
			break;
		case "nomad":
			return 0xFF9900;
			break;
	}
	
}

function formattedDate(d = new Date) {
  let month = String(d.getMonth() + 1);
  let day = String(d.getDate());
  const year = String(d.getFullYear());

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return `${month}/${day}/${year}`;
}

function isAlphanumeric(str){
	if( /[^a-zA-Z0-9]/.test( str ) ) {
	   return false;
	}
	return true;     
}

function isNumeric(str){
	if( /[^0-9]/.test( str ) ) {
	   return false;
	}
	return true;     
}
//...//


//EXPORTS FOR SHARED USE
module.exports = {
   react: 
	function(message, function_callback){
		react(message, function_callback);
	},
   sendMessage: 
	function(channel, msgString){
		return sendMessage(channel, msgString);
	},
   addPoints: 
	function(database, userList, int_points){
		addPoints(database, userList, int_points, function(){});
	},
    getPoints:
    function(database, userId, function_callback){
        getPoints(database, userId, function_callback);
    }
}