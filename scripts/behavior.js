///////////////////
///
/// This behavior script handles most of the bot behavior
/// 
///
///////////////////

const Discord = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require("fs");
const he = require('he');
const fetch = require("node-fetch");

const ircUplink = require('./irc_uplink.js');
const linker = require('./faf_account_linking.js');
const rss = require('./rss_feed.js');
const bans = require('./bans.js');
const utils = require('./utility.js');

const db = new sqlite3.Database(process.cwd()+'/_private/userdata.db');

let receivers = [];
let announcers = [];
let lastAnimatedMessage = {};
let lastIrcMessage;
let ircRestarting = false;

/// Constants for command state

const COMMAND_SUCCESS = 0;
const COMMAND_COOLDOWN = 1;
const COMMAND_UNKNOWN = 2;
const COMMAND_MISUSE = 3;
const COMMAND_FORBIDDEN = 4;

/////////////////
////
/// Execute command given
/// Main bot behavior function
///
function executeCommand(command, arguments, cooldown, message, settings, utils, callback){

    // These commands won't be affected by cooldown
	//TODO: these commands should be in the settings file
	const cooldownWhitelist = ["subscribe", "unsubscribe"];
	const developer = isDeveloper(message.author, settings);

	if (!developer &&  settings["dev-only-mode"]){
		utils.log(message.author.username+" tried to fire command while in dev-only mode", "!!", message.guild);
		callback(COMMAND_FORBIDDEN);
	}
	else if (!developer && cooldown > 0 && cooldownWhitelist.indexOf(command) < 0){
		/// Animates cooldown
		animateCooldown(message, cooldown);
		callback(COMMAND_COOLDOWN);
	}
	else if (!developer && isDeveloperCommand(command, settings)){
		utils.log(message.author.username+" tried to fire a developer command without being dev", "!!", message.guild);
		callback(COMMAND_FORBIDDEN);
	}
	else if (!developer && isRestrictedCommand(command, message.guild) && !isModerator(message.member, message.guild)){
		utils.log(message.author.username+" tried to fire a restricted command", "!!", message.guild);
		callback(COMMAND_FORBIDDEN);
	}
	else if (!developer && isBlacklistedUser(message.author, message.guild)){
		utils.log(message.author.username+" tried to fire a command, but is blacklisted", "!!", message.guild);
		callback(COMMAND_FORBIDDEN);
	}
	else{
		switch (command){
			default:
                const specs = utils.getSpecifics(message.guild);
                if (specs["recorded-messages"][command]){
					sendMessage(message.channel, specs["recorded-messages"][command])
					.then(callback(COMMAND_SUCCESS));
                }
                else{
                    callback(COMMAND_UNKNOWN);
                }
				break;

			case "respond":
			case "alive":
				replyToMessage(message, "Dostya is still up.")
					.then(callback(COMMAND_SUCCESS));
				break;

			case "unit":
			case "searchunit":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchUnitData(arguments, settings.urls.unitDB, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "wiki":
				if (arguments == null ||!utils.isAlphanumeric(arguments.replace(/ /g, ""))){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchWikiArticle(arguments, settings.urls.wiki, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "pool":
			case "ladderpool":
			case "ladder":
			case "mappool":
				fetchLadderPool(settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "replay":
			case "lastreplay":
				if (arguments == null || (command == "replay" && !utils.isNumeric(arguments))){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchReplay(command, arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "clan":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchClan(arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "player":
			case "ratings":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchPlayer(arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

            case "map":
                if (arguments == null){
                    callback(COMMAND_MISUSE);
                    break;
                }
                arguments = escapeArguments(arguments);
                fetchMap(arguments, settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
                });
                break;

			case "searchplayer":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
				fetchPlayerList(arguments, settings['player-search-limit'], settings.urls.data, function(content){
					sendMessage(message.channel, content)
					.then(callback(COMMAND_SUCCESS))
				});
				break;

			case "help":
				sendMessage(message.author, "Consult Dostya-bot help here : \r\nhttps://github.com/FAForever/Dostya/blob/master/README.md")
				.then(callback(COMMAND_SUCCESS));
				break;

			case "sendtracker":
			case "tracker":
				sendTrackerFile(message.author, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "logs":
				sendBotLogs(message.author)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "def":		/// !def announcement-channels array #test
			case "define":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				const args = arguments.split(" ");
				if (args.length < 3){
					callback(COMMAND_MISUSE)
				}
				defineSpecific(message, args[0], args[1], args[2])
					.then(callback(COMMAND_SUCCESS));
				break;

			case "restrict":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				restrictCommand(message.author, arguments, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "unrestrict":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				unrestrictCommand(message.author, arguments, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "restrictions":
				sendRestrictions(message.author, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "blacklist":
				if (arguments == null){
					sendBlacklist(message.author, message.guild)
						.then(callback(COMMAND_SUCCESS));
					break;
				}
				blacklistUser(message.author, arguments, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "unblacklist":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				unblacklistUser(message.author, arguments, message.guild)
					.then(callback(COMMAND_SUCCESS));
				break;

			case "kill":
				utils.log("KILL from "+message.author.username+" -- Exiting.", "XX", message.guild);
                stopIrc(settings, "Dostya killed");
				process.exit(1);
				break;

            case "fixbridge":
                const r = restartIrc(settings, "Manual restart");
                let msg;
                if (r){
                    msg = "All IRC bridges will restart in 5 seconds.";
                }
                else{
                    msg = "Restart failed. The bridges may already be restarting.";
                }
				sendMessage(message.channel, msg)
				.then(callback(COMMAND_SUCCESS));
                break;

            case "link":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
                const username = escapeArguments(arguments);
                link(message, username);
                callback(COMMAND_SUCCESS);
                break;

            case "links":
            case "showlinks":
                sendLinktable(message.channel, settings)
                .then(callback(COMMAND_SUCCESS));
                break;

            case "unlink":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
                unlink(arguments, message.guild, function(){callback(COMMAND_SUCCESS);});
                break;

            case "loghere":
                let specifics = utils.getSpecifics(message.guild);
                specifics['moderator-log-channel'] = message.channel.id;
                utils.writeSpecifics(message.guild, specifics);
                utils.log('Registered #'+message.channel.name+' for logging', '>>', message.guild);
                logForModerators(message.guild, "Registered `"+message.channel.name+"` for logging");
                callback(COMMAND_SUCCESS);
                break;

            case "testlog":
                logForModerators(message.guild, "This is the moderator logging channel");
                callback(COMMAND_SUCCESS);
                break;

            case "record":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments).replace("\\\\", "\\");

                const i = arguments.indexOf(" ");
                const recording = [arguments.slice(0,i), arguments.slice(i+1)];

				if (i < 0){
                    if (recording.length > 1){
                        deleteRecord(message.guild, settings, arguments);
                        callback(COMMAND_SUCCESS);
                        break;
                    }
                    else{
                        callback(COMMAND_MISUSE);
                        break;
                    }
				}
                addRecord(message.guild, settings, recording[0], recording[1]);
                callback(COMMAND_SUCCESS);
                break;

            case "showrecords":
            case "records":
                sendRecords(message.channel, settings);
                callback(COMMAND_SUCCESS);
                break;

            case "warn":
            case "kick":
            case "ban":
            case "unban":
            case "pardon":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
                takeActionFromMessage(message, command, arguments)
                .then(callback(COMMAND_SUCCESS));

                break;

            case "userinfo":
				if (arguments == null){
					callback(COMMAND_MISUSE);
					break;
				}
				arguments = escapeArguments(arguments);
                let id = utils.getIdFromString(arguments);
                if (utils.isNumeric(arguments)){
                    id = arguments;
                }
                bans.getUserInfo(message.guild, id, function(content){
                    logForModerators(message.guild, content);
                }).then(
                    callback(COMMAND_SUCCESS)
                );

                break;

            case "createrole":
                if (arguments == null){
                    callback(COMMAND_MISUSE);
                    break;
                }
                let roleName = escapeArguments(arguments);

                if(roleExists(roleName, message.guild)) {
                    sendMessage(message.channel, "Role already registered.")
                        .then(callback(COMMAND_MISUSE));
                    break;
                }

                createRole(roleName, message)
                    .then(callback(COMMAND_SUCCESS), callback(COMMAND_SUCCESS));

                break;

            case "deleterole":
                if (arguments == null){
                    callback(COMMAND_MISUSE);
                    break;
                }
                let delRoleName = escapeArguments(arguments);

                if(! roleExists(delRoleName, message.guild)) {
                    sendMessage(message.channel, "Role not registered. Are you sure the spelling is correct?")
                        .then(callback(COMMAND_MISUSE));
                    break;
                }

                deleteRole(delRoleName, message)
                    .then(callback(COMMAND_SUCCESS), callback(COMMAND_SUCCESS));

                break;

            case "subscribe":
                if (arguments == null){
                    callback(COMMAND_MISUSE);
                    break;
                }
                let subscribeRoleName = escapeArguments(arguments);

                if(! roleExists(subscribeRoleName, message.guild)) {
                    sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
                        .then(callback(COMMAND_MISUSE));
                    break;
                }

                subscribe(subscribeRoleName, message)
                    .then(callback(COMMAND_SUCCESS), callback(COMMAND_SUCCESS));

                break;

            case "unsubscribe":
                if (arguments == null){
                    callback(COMMAND_MISUSE);
                    break;
                }
                let unsubscribeRoleName = escapeArguments(arguments);

                if(! roleExists(unsubscribeRoleName, message.guild)) {
                    sendMessage(message.channel, "Unknown role. Are you sure the spelling is correct?")
                        .then(callback(COMMAND_MISUSE));
                    break;
                }

                unsubscribe(unsubscribeRoleName, message)
                    .then(callback(COMMAND_SUCCESS), callback(COMMAND_SUCCESS));

                break;

            case "roles":

                let specificsSubscriptions = utils.getSpecifics(message.guild);

                let subscriptionsMessage = specificsSubscriptions["registeredRoles"].join("\n");
                sendMessage(message.channel, subscriptionsMessage)
                    .then(callback(COMMAND_SUCCESS));

                break;
		}
	}
}
///
/// End of
///
///////////////

/**
 * Checks wether a role is already present
 * @param {String} roleName The role to check
 * @param {Guild} guild The guild to investigate
 * @returns {boolean} Wether this role is already present in the guild specifics
 */
function roleExists(roleName, guild) {
    let specifics = utils.getSpecifics(guild);
    return specifics["registeredRoles"].some(role => role === roleName)
}

/**
 * Creates a new role in the specifics and on the discord server
 * Won't check if the role is present
 * @param {String} roleName The name of the role to create
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role creation succeeded and completes exceptionally when the creation failed due to the discord server
 */
async function createRole(roleName, message) {
	let specifics = utils.getSpecifics(message.guild);
    specifics["registeredRoles"].push(roleName);
    utils.writeSpecifics(message.guild, specifics);
    try {
		await message.guild.createRole({name: roleName, color: "LIGHT_GREY", mentionable: true, hoist: false}, "Created by Dostya as requested by" + message.author.username);
        utils.log(`Created role ${roleName} as requested by discord user ${message.author.id}`, "--", message.guild);
	} catch(e) {
        let specificsCreateRoleFailed = utils.getSpecifics(message.guild);
        specificsCreateRoleFailed.registeredRoles = specificsCreateRoleFailed.registeredRoles.filter(role => role !== roleName);
        utils.writeSpecifics(message.guild, specificsCreateRoleFailed);
        utils.log("Error while creating role. Reason: " + e, "WW", message.guild);
        await sendMessage(message.channel, "Could not create role `"+roleName+"` due to internal discord error. Please contact an administrator. Error: " + e);
        return;
	}

    await sendMessage(message.channel, "Role `"+roleName+"` created");
}

/**
 * Deletes a role in the specifics and on the discord server
 * Won't check if the role is present
 * @param {String} roleName The name of the role to delete
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role deletion succeeded and completes exceptionally when the deletion failed due to the discord server
 */
async function deleteRole(roleName, message) {
	let specifics = utils.getSpecifics(message.guild);
	specifics.registeredRoles = specifics.registeredRoles.filter(role => role !== roleName);
	utils.writeSpecifics(message.guild, specifics);

	let roleToDelete = Array.from(message.guild.roles.values()).find(role => role.name === roleName);
	if(roleToDelete !== undefined) {
		try {
            await roleToDelete.delete();
		} catch(e) {
			utils.log(`Role ${roleName} unregistered. Could not delete the discord role. (failed due to discord error ` + e + `)`);
            await sendMessage(message.channel, "Role `"+roleName+"` was unregistered from Dostya. I could not delete the discord role - Maybe permissions are missing? Please remove the discord role manually. (Error: " + e + ")");
            return;
		}
		utils.log(`Role ${roleName} deleted.`, "--", message.guild);
		await sendMessage(message.channel, "Role `"+roleName+"` deleted");
	} else {
		utils.log(`Role ${roleName} unregistered. Could not delete the discord role. (not found)`, "WW", message.guild);
		await sendMessage(message.channel, "Role `"+roleName+"` was unregistered from Dostya. Discord role could not be deleted - Maybe permissions are missing?\nPlease remove the discord role `"+roleName+"` manually.")
	}
}

/**
 * Subscribe to a role (assign discord role)
 * Won't check if the role is present (If called without checking beforehand this can assign potentially hazardous roles like administrator to users )
 * @param {String} roleName The name of the role
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role (un)subscription and completes exceptionally when the (un)subscription failed due to the discord server
 */
async function subscribe(roleName, message) {
    let roleToSubscribe = Array.from(message.guild.roles.values()).find(role => role.name === roleName);

    if(roleToSubscribe !== undefined) {
        let guildMember = await message.guild.fetchMember(message.author);
        await guildMember.addRole(roleToSubscribe);
        utils.log(`Added member ${message.author.id} to role ${roleName}.`, "--", message.guild);
        await message.react("✅");
        setTimeout(function(){message.clearReactions();}, 3000);
    } else {
        utils.log(`Failed adding member ${message.author.id} to role ${roleName}. (role not found on discord server)`, "WW", message.guild);
        await sendMessage(message.channel, "Role `"+roleName+"` is absent from the discord server. Please ask a moderator for help. (Dostya knows this role, but the discord server does not)");
    }
}

/**
 * Unsubscribe from a role (remove discord role)
 * Won't check if the role is present (If called without checking beforehand this can assign potentially hazardous roles like administrator to users )
 * @param {String} roleName The name of the role
 * @param {Message} message The message from which to parse guild and author
 * @returns {Promise<any>} A promise that completes successfully when the role (un)subscription and completes exceptionally when the (un)subscription failed due to the discord server
 */
async function unsubscribe(roleName, message) {
    let roleToUnsubscribe = Array.from(message.guild.roles.values()).find(role => role.name === roleName);

    if(roleToUnsubscribe !== undefined) {
        let guildMember = await message.guild.fetchMember(message.author);
        await guildMember.removeRole(roleToUnsubscribe);
        utils.log(`Removed member ${message.author.id} from role ${roleName}.`, "--", message.guild);
        await message.react("✅");
        setTimeout(function(){message.clearReactions();}, 3000);
    } else {
        utils.log(`Failed removing member ${message.author.id} from role ${roleName}. (role not found)`, "WW", message.guild);
        await sendMessage(message.channel, "Role not present on discord server.");
    }
}




/// Will generate a bans.takeAction() from the action command message
async function takeActionFromMessage(message, action, arguments){
    let ACTION;
    switch (action){
        case "warn":
            ACTION = bans.ACTIONS.WARN;
            break;
        case "kick":
            ACTION = bans.ACTIONS.KICK;
            break;
        case "ban":
            ACTION = bans.ACTIONS.BAN;
            break;
        case "unban":
        case "pardon":
            ACTION = bans.ACTIONS.UNBAN;
            break;
    }

    let i = arguments.indexOf(" ");
    let data = [arguments.slice(0,i), arguments.slice(i+1)];

    let targetId;
    let str = '';

    if (i < 0){
        targetId = utils.getIdFromString(arguments);
    }
    else{
        targetId = utils.getIdFromString(data[0]);
        str = data[1];
    }

    const author = message.member;
    let target = targetId;
    try{
        // No need to check if the user is here if we're about to unban him
        if (ACTION != bans.ACTIONS.UNBAN){
            target = await message.guild.members.get(targetId);
        }
    }
    catch(e){
        if (e){
            utils.log("Discarding moderator action from "+author.user.username+" because of an user fetching error", "WW", message.guild);
            return;
        }
    }
    finally{
        if (!target){
            utils.log("Discarding moderator action from "+author.user.username+" because of invalid target", "WW", message.guild);
            return;
        }

        /// Ban duration indicator
        let revokeAt = null;
        if (ACTION === bans.ACTIONS.BAN){
            i = str.indexOf(">");
            data = [str.slice(0,i), str.slice(i+1)];

            if (i > -1){
                str = data[0];
                revokeAt = Date.now() + data[1] * 3600 * 1000; // Hours into miliseconds
                revokeAt /= 1000; // Miliseconds into seconds
            }
        }

        bans.takeAction(ACTION, message.guild, target, author, str, revokeAt);

        return true;
    }
}

/// Initialize ban events
function initializeBans(settings, client){
    bans.initialize(client.guilds);

    bans.status.on(bans.ACTIONS.WARN, function (targetGuildMember, authorGuildMember, str){
        logForModerators(authorGuildMember.guild, "🚨 "+targetGuildMember.user.username+" has been **WARNED** by `"+authorGuildMember.user.username+"`. Reason : "+str);
    });
    bans.status.on(bans.ACTIONS.KICK, function (targetGuildMember, authorGuildMember, str){
        logForModerators(authorGuildMember.guild, "🥊 "+targetGuildMember.user.username+" has been **KICKED** by `"+authorGuildMember.user.username+"`. Reason : "+str);
    });
    bans.status.on(bans.ACTIONS.BAN, function (targetGuildMember, authorGuildMember, str, revokeAt){
        logForModerators(authorGuildMember.guild, "🚫 "+targetGuildMember.user.username+" has been **BANNED** by `"+authorGuildMember.user.username+"`. Reason : "+str);
        if (revokeAt){
            logForModerators(authorGuildMember.guild, "This action will be revoked at `"+new Date(revokeAt*1000).toLocaleString()+"`");
        }
    });
    bans.status.on(bans.ACTIONS.UNBAN, function (targetGuildMember, authorGuildMember, str){
        logForModerators(authorGuildMember.guild, "🛐 <@"+targetGuildMember.id+"> has been **PARDONNED** by `"+authorGuildMember.user.username+"`. Reason : "+str);
    });
    setInterval(function(){
        bans.updateBans(client.guilds);
    }, settings["ban-update-rate"]*1000);
}

/// Sends records on this channel 
function sendRecords(channel, settings){
    let message = '```';
    const specs = utils.getSpecifics(channel.guild);
    for (let k in specs["recorded-messages"]){
        const cmd = settings["prefixes"][0]+k;
        const content = specs["recorded-messages"][k];

        const line = cmd+" => "+content+"\n\n";

        if (message.length + line.length >= 2000){
            sendMessage(channel, message+"```");
            message = '```';
        }
        message += line;
    }
    sendMessage(channel, message+"```");
}

/// Adds a recording to play with a user-registered command.
function addRecord(guild, settings, key, message){
    let guildSpecifics = utils.getSpecifics(guild);
    if (!guildSpecifics['recorded-messages']){
        guildSpecifics['recorded-messages'] = {};
    }

    // Cloning existing record
    if (guildSpecifics['recorded-messages'][message]){
        message = guildSpecifics['recorded-messages'][message];
    }
    guildSpecifics['recorded-messages'][key] = message;

    utils.writeSpecifics(guild, guildSpecifics);
    logForModerators(guild, "Added recording ["+settings["prefixes"][0]+key+"] => "+message+"");
}

/// Deletes an user registered recording
function deleteRecord(guild, settings, key){
    let guildSpecifics = utils.getSpecifics(guild);
    delete guildSpecifics['recorded-messages'][key];
    utils.writeSpecifics(guild, guildSpecifics);
    logForModerators(guild, "Deleted recording ["+settings["prefixes"][0]+key+"]");
}

/// Breaks link between discord user and faf user, and logs in moderator room of the guild
function unlink(discordTagOrFafId, guild, callback){
    let fafId = "-1";
    let discordId = "-1";

    // FAF ID
    if (utils.isNumeric(discordTagOrFafId)){
        fafId = discordTagOrFafId;
    }

    // Discord ping
    else if (discordTagOrFafId.substr(0,1) === "<"){
        discordId = utils.getIdFromString(discordTagOrFafId);
        let stop = false;
        ifLinked(discordId, function(isLinked){
            if (!isLinked){
                stop = true;
            }
        });
        if (stop){
            callback(false);
            return;
        }
    }

    // Command misuse
    else{
        callback(false);
        return;
    }

    db.run("DELETE FROM account_links WHERE faf_id="+fafId+" OR discord_id='"+discordId+"'", callback)
    logForModerators(guild, "Account unlinked ("+fafId+"<>"+discordId+")");
}

/// Display link table in a channel with ASCII character
async function sendLinktable(channel, settings){
    return db.all('SELECT * FROM account_links ORDER BY create_time', async function(err, rows){
        if (err){
            utils.log("Error fetching rows for account linking", "WW", channel.guild);
            console.log(err);
            return;
        }
        let message = '```FAF:ID => Discord:ID```';
        for (let k in rows){
            const response = await fetch(settings.urls.data+'player?filter=id=='+rows[k].faf_id+'&fields[player]=login');
            const json = await response.json();
            const playerName = json.data[0].attributes.login;
            let userName;
            const getMember = await channel.guild.members.get(rows[k].discord_id)
            try{
                userName = getMember.user.tag;
            }
            catch(e){
                // User is probably banned or left from this discord
                userName = '<unknown>';
            }
            finally{
                const line = "```"+playerName+":"+rows[k].faf_id+" => "+userName+":"+rows[k].discord_id+"```";
                if (message.length + line.length >= 2000){
                    sendMessage(channel, message);
                    message = '';
                }
                message += line;
            }
        }
        sendMessage(channel, message);
    });
}

/// Initializes RSS articles fetching and announcer channels
function initializeRss(settings){
    rss.initialize(settings);
    rss.status.on('newArticle', function (article){
        let message = '';
        message += '**'+he.decode(article.title)+'** - ('+article.author+')'+'\n';
        message += article.link +'\n\n';
        // Uncommented, the following line will display the news content decoded.
        //message += he.decode(utils.stripTags(article.description.replace(/<br \/>/g, '\n')))+'\n';
        message += '\n(Published ' + article.pubDate+')';

        for (let k in announcers){
            const announcer = announcers[k];
            const limit = 1999; // Discord messages are limited to 2000 characters
            for (i = 0; i < message.length/limit; i+= 1){
                let cut = message.substr(i*limit, (i+1)*limit);
                sendMessage(announcer, cut);
            }
        }

    });
}

/// Initializes IRC connection
function initializeIrc(settings){
	utils.log("Initializing IRC client...", "--");
    ircUplink.status.on('connectionClosed', function(errorName){
        if (ircUplink.getClient() != undefined){
            restartIrc(settings, errorName);
        }
    });
    for (let k in settings['allowed-bridges']){
        ircUplink.channels.push("#"+k);
    }
    startIrc(settings);
}

/// Properly ends IRC connection and notifies
function stopIrc(settings, errorName){
    /// Something happened to the bridge
    for (k in ircUplink.channels){
        const channel = ircUplink.channels[k];
        sendFromIrc(channel.substr(1, channel.length), "IRC", "`Connection closed by remote host : ["+errorName+"]. Dostya will reconnect as soon as possible.`");
    }
    utils.log('Killing IRC client because of '+errorName);
    ircUplink.killClient();
}

/// Starts IRC and sets up emitters
function startIrc(settings){
    if (ircUplink.getClient() == undefined){
        ircRestarting = false;
        ircUplink.initializeClient(function(ircClient){
            /// On irc message received, send from IRC
            for (let i = 0; i < ircUplink.channels.length; i++){
                const channelName = ircUplink.channels[i];
                ircClient.on('message'+channelName, function (author, message) {
                    if (author != ircClient.nick){
                        utils.log("[FIRC] [FROM "+author+"#"+channelName+"] "+author+": "+message, "++", ircUplink.fakeGuild);
                        sendFromIrc(channelName.substr(1, channelName.length), author, message);
                    }
                });
                sendFromIrc(channelName.substr(1, channelName.length), "IRC", "`Connection established.`");
            }

            /// Add checkmark on last sent irc message on delivery
            ircClient.on('selfMessage', function (to, messageText){
                validateLastIrcMessage(messageText);
            });
        });
    }
    else{
        utils.log('IRC Client already started, not starting another one.', 'WW');
    }
}
/// Stops and start irc
function restartIrc(settings, errorName){
    if (!ircRestarting){
        ircRestarting = true;
        stopIrc(settings, errorName);
        setTimeout(function(){startIrc(settings)}, 5000);
        return true;
    }
    else{
        return false;
    }
}

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

		for (let property of member.roles) {
			const role = property;

			if (thisModId.search('<@&'+role[0]+'>') > -1){
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
function addToReceivers(ircChannel, channelObject){
    if (receivers[ircChannel] == undefined){
        receivers[ircChannel] = [];
    }
	receivers[ircChannel].push(channelObject);
}

/// Clears the announcers list
function cleanAnnouncers(){
	announcers = [];
}

/// Add to the list of announcer channels - channels that will receive RSS news
function addToAnnouncers(channelObject){
	announcers.push(channelObject);
}

/// Adds a little V reaction on the last successfully sent message to the irc
function validateLastIrcMessage(messageText){
	if (lastIrcMessage == undefined || messageText === formatIrcMessage(lastIrcMessage.author.username, lastIrcMessage.content)){
		lastIrcMessage.react("✅");
	}
}

/// Manage message and sends to IRC
function uplink(ircChannel, message, settings){
	if (message.channel.name == ircChannel){
		if (lastIrcMessage != undefined){
			lastIrcMessage.channel.fetchMessage(lastIrcMessage.id)
				.then(msg => msg.clearReactions());
		}
		lastIrcMessage = message;

        if (isUplinkAllowed(settings, ircChannel, message.guild.id)){
            let ok = false;
            ifLinked(message.author.id, function(isLinked){
                if (isLinked){
                    utils.log("[TIRC#"+ircChannel+"] [FROM: "+message.author.id+"@"+message.guild.id+"] "+formatIrcMessage(message.author.username, message.content), "++", message.guild);
                    sendToIrc(ircChannel, message.author.username, message.content);
                    ok = true;
                    /* Uncommenting this will delete the original message and repost
                    message.channel.send('**'+message.author.username+'**: '+message.content);
                    message.delete();
                    */
                }
                else{
                    message.react("❌");
                    sendMessage(message.author, "You must link your discord account to FAF to use #"+ircChannel+" with the bridge.\nUse the `!link fafAccountName` command to link your account.");
                }
            });
            return ok;
        }
        else{
            message.react("🔇");
            return false;
        }
	}
	else{
		return false;
	}
}

/// Checks if the guild has write access to that IRC channel
function isUplinkAllowed(settings, channel, guildId){
    const allowed = settings['allowed-bridges'];
    const allowedFor = allowed[channel];
    return allowedFor.indexOf(guildId) > -1;
}

/// Sends message to the IRC
function sendToIrc(channelName, authorString, messageString){
	ircUplink.sendIrcMessage(channelName, formatIrcMessage(authorString, messageString));
}

/// Format for IRC
function formatIrcMessage(authorString, messageString){
	return authorString+': '+messageString;
}

/// Sends a message received from the IRC
function sendFromIrc(channelName, authorString, messageString){
	for (let i = 0; i < receivers[channelName].length; i++){
		let channel = receivers[channelName][i];
		if (channel != undefined){
			sendMessage(channel, '**'+authorString+'**: '+messageString);
		}
	}
}
/// PMS welcome message to the user
function sendWelcomeMessageTo(guildMember){
    guildMember.send("Hello and Welcome to the **FAF Discord Server**. We are quite active and are happy to help with any problems you may have. \n\n__**Useful Links**__\nForums: http://forums.faforever.com/index.php \nWiki: https://wiki.faforever.com/index.php?title=Main_Page \nClient Download: https://faforever.com/client")
    .catch(e => {
        utils.log("Could not send welcome message to "+guildMember.user.username+"");
    });
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
   let fetchUrl = apiUrl+'game?filter=id=='+replayIdOrName+'&'+includes;

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

			data.data = data.data[0];

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
					"name": "Map is ranked",
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
					"title": "**Ladder maps pool (First 25 entries)**",
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
function fetchMap(mapNameOrId, apiUrl, callback){

    let filter = 'displayName=="'+mapNameOrId+'"';
    if (utils.isNumeric(mapNameOrId) && !isNaN(parseFloat(mapNameOrId))){
        filter = 'id=='+mapNameOrId+'';
    }
    const fetchUrl = apiUrl+'map?filter='+filter+'&page[size]=1&include=versions';

	utils.httpsFetch(fetchUrl, function(d){
		if (Number.isInteger(d)){
			callback("Server returned the error `"+d+"`.");
			return;
		}

		const data = JSON.parse(d);
		if (data != undefined && data.included != undefined){

			let map = {};
            map.author = "Unknown";

            const mapData = data.data[0];
            const includes = data.included;

			for (let i = 0; i < includes.length; i++){
				let thisData = includes[i];
				switch (thisData.type){
					default:
						continue;
						break;

					case "mapVersion":
						map.imgUrl = thisData.attributes.thumbnailUrlLarge.replace(/( )/g, "%20");
						map.version = thisData.attributes.version;
						map.size = ((thisData.attributes.width/512)*10)+"x"+((thisData.attributes.height/512)*10)+" km";
                        map.description = thisData.attributes.description.replace(/<\/?[^>]+(>|$)/g, "");;
                        map.downloadUrl = thisData.attributes.downloadUrl;
                        map.maxPlayers = thisData.attributes.maxPlayers;
                        map.ranked = thisData.attributes.ranked;
						break;

					case "player":
                        map.author = thisData.attributes.login;
						break;
				}
			}

            map.id = mapData.id;
            map.displayName = mapData.attributes.displayName;
            map.createTime = mapData.attributes.createTime;

			let embedMes = {
				  "embed": {
					"title": "Download map",
                    "description": map.description,
					"color": 0xFF0000,
                    "author":{
                        "name":""+map.displayName+" (id #"+map.id+")",
                        "url": map.downloadUrl
                    },
                    "image": {
                      "url": map.imgUrl
                    },
					"fields": [
                        {
                            "name": "Size",
                            "value": map.size,
                            "inline": true
                        },
                        {
                            "name": "Max players",
                            "value": map.maxPlayers,
                            "inline": true
                        },
                        {
                            "name": "Ranked",
                            "value": map.ranked,
                            "inline": true
                        },
                        {
                            "name": "Created at",
                            "value": map.createTime,
                            "inline": true
                        },
                        {
                            "name": "Author",
                            "value": map.author,
                            "inline": true
                        }
                    ]
				  }
				}

            if (map.downloadUrl != undefined){
                embedMes.embed.url = map.downloadUrl.replace(/ /g, "%20");
                embedMes.embed.author.url = map.downloadUrl.replace(/ /g, "%20");
            }

            callback(embedMes);
            return;

		}
		else{
			callback("Could not find map");
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

	if (channel instanceof Discord.Channel){
		const myPermissions = channel.permissionsFor(channel.guild.me);
		canSend = myPermissions.has('SEND_MESSAGES');
	}

	if (canSend){
		//utils.log("Sent message "+msgContent+" on "+channel.toString()+"", "DD", channel.guild);
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

// Initializes the database
function initializeDatabase(settings){
    fs.readFile(process.cwd()+"/configuration/database_setup.sql", 'utf8', function(err, data){
        db.run(data);
    });
}

function linkUser(discordId, fafId){
    db.run("INSERT INTO account_links (faf_id, discord_id) VALUES ("+fafId+", '"+discordId+"')");
}

function logForModerators(guild, message){
    let specifics = utils.getSpecifics(guild);
    if (guild.channels.exists("id", specifics['moderator-log-channel'])){
        const modLog = guild.channels.find("id", specifics['moderator-log-channel']);
        sendMessage(modLog, message);
    }
    else{
        specifics['moderator-log-channel'] = null;
        utils.writeSpecifics(guild, specifics);
    }
}

function link(message, username){
    ifLinked(message.author.id, function(isLinked){
        if (!isLinked){
            linker.start(message.author.id)
            .then(function(address){
                sendMessage(message.author, "You have requested to link account with faf account `"+username+"`. To proceed, please open the address "+address+" in your browser and log-in.\nYou have **30 SECONDS** before the link expires.");
                linker.status.on("success", function(login, fafId, discordId){
                    if (discordId == message.author.id){
                        if (login == username){
                            linkUser(discordId, fafId);
                            const logMessage = "`"+login+":"+fafId+"` has been linked to discord user `"+message.author.tag+":"+discordId+"`";
                            sendMessage(message.author, "The FAF user `"+login+"` has successfully been linked with your discord account. :slight_smile:");
                            utils.log(logMessage, '--', message.guild);

                            // Notice the moderation channel
                            logForModerators(message.guild, logMessage);
                        }
                        else{
                            sendMessage(message.author, "The FAF username `"+login+"` is different from the username provided (`"+username+"`). No link could be established.");
                        }
                        sendMessage(message.author, "You can now safely close your log-in browser tab.");
                    }
                });
                linker.status.on("expired", function(discordId){
                    if (discordId == message.author.id){
                        sendMessage(message.author, "The link has expired");
                    }
                });
            });
        }
        else{
            sendMessage(message.author, "Your discord account is already linked to a FAF account.");
        }
    });
}

function ifLinked(discord_id, callback){
    db.get("SELECT faf_id FROM account_links WHERE discord_id="+discord_id, function(err, row){
        callback(!err && row != undefined);
    });
}

module.exports = {

	COMMAND_SUCCESS:COMMAND_SUCCESS,
	COMMAND_COOLDOWN:COMMAND_COOLDOWN,
	COMMAND_UNKNOWN:COMMAND_UNKNOWN,
	COMMAND_MISUSE:COMMAND_MISUSE,
	COMMAND_FORBIDDEN:COMMAND_FORBIDDEN,

	addToReceivers:
	function(ircChannel, receiverChannel){
		return addToReceivers(ircChannel, receiverChannel);
	},
	addToAnnouncers:
	function(receiverChannel){
		return addToAnnouncers(receiverChannel);
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
	function(channelName, authorString, messageString){
		return sendFromIrc(channelName, authorString, messageString);
	},
	uplink:
	function(ircChannel, message, settings){
		return uplink(ircChannel, message, settings);
	},
   aliasCommand:
	function(message, settings){
		return aliasCommand(message, settings);
	},
    cleanReceivers:
	function(){
		return cleanReceivers();
	},
    cleanAnnouncers:
	function(){
		return cleanAnnouncers();
	},
	initializeIrc:
	function(settings){
		return initializeIrc(settings);
	},
    initializeDatabase:
    function (settings){
        return initializeDatabase(settings);
    },
    initializeRss:
    function (settings){
        return initializeRss(settings);
    },
    initializeBans:
    function (settings, client){
        return initializeBans(settings, client);
    },
    stopIrc:
    function(settings, errName){
        return stopIrc(settings, errName);
    }
};
