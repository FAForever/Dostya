const utils = require("../utility");
const {sendMessage} = require("./discord");
const db = require("../db").db;


/// Fetches an embed message about the replay given / id or playername
function fetchReplay(command, replayIdOrName, apiUrl, callback) {

    const includes = 'include=mapVersion,playerStats,mapVersion.map,playerStats.player,featuredMod,playerStats.player.globalRating,playerStats.player.ladder1v1Rating';
    let fetchUrl = apiUrl + 'game?filter=id==' + replayIdOrName + '&' + includes;

    if (command === 'lastreplay') {
        fetchUrl = apiUrl + 'game?filter=playerStats.player.login=="' + replayIdOrName + '"&sort=-endTime&page[size]=1&' + includes;
    }

    utils.httpFetch(fetchUrl, function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }
        const data = JSON.parse(d);

        if (data != undefined && data.data != undefined && (
            (Array.isArray(data.data) && data.data.length > 0) || data.data.attributes != undefined)
        ) {

            data.data = data.data[0];

            let replay = {
                id: replayIdOrName,
                name: data.data.attributes.name,
                replayUrl: data.data.attributes.replayUrl.replace(/( )/g, "%20"),
                startTime: data.data.attributes.startTime,
                victoryCondition: data.data.attributes.victoryCondition,
                validity: data.data.attributes.validity,
                gameType: "",
                technicalGameType: "",
                imgUrl: "",
                mapName: "",
                mapVersion: "",
                mapType: "",
                mapSize: "",
                players: {},
                ranked: false
            };

            const inc = data.included;

            for (let i = 0; i < inc.length; i++) {
                let thisData = inc[i];
                switch (thisData.type) {
                    default:
                        continue;
                        break;

                    case "mapVersion":
                        replay.imgUrl = thisData.attributes.thumbnailUrlSmall.replace(/( )/g, "%20");
                        replay.mapVersion = thisData.attributes.version;
                        replay.mapSize = ((thisData.attributes.width / 512) * 10) + "x" + ((thisData.attributes.height / 512) * 10) + " km";
                        replay.ranked = thisData.attributes.ranked;
                        break;

                    case "map":
                        replay.mapName = thisData.attributes.displayName;
                        replay.mapType = thisData.attributes.mapType;
                        break;

                    case "gamePlayerStats":
                        const gpsid = thisData.relationships.player.data.id;
                        if (!replay.players[gpsid]) {
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
                        if (replay.players[pid] == undefined) {
                            replay.players[pid] = {};
                        }
                        replay.players[pid].name = thisData.attributes.login;

                        break;

                    case "featuredMod":
                        switch (thisData.attributes.technicalName) {
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
            if (replay.gameType != "") {
                gm = "[" + gm + "] ";
            }

            let embedMes = {
                "embed": {
                    "title": "**Download replay #" + replay.id + "**",
                    "url": replay.replayUrl,
                    "color": 0xFF0000,
                    "thumbnail": {
                        "url": replay.imgUrl
                    },
                    "author": {
                        "name": gm + replay.name,
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
                            "value": replay.mapName + " [" + replay.mapVersion + "] (" + replay.mapSize + ")"
                        }
                    ]
                }
            };

            const keys = Object.keys(replay.players);
            for (let i = 0; i < keys.length; i++) {
                const id = keys[i];
                const p = replay.players[id];

                let rating = "0";

                if (replay.technicalGameType == "ladder1v1") {
                    rating = "L" + p.ladderRating;
                } else {
                    rating = "G" + p.globalRating;
                }

                let pNameString = "" + utils.getFaction(p.faction).substring(0, 1).toUpperCase() + " - " + p.name + " [" + rating + "]";

                let value = "";

                if (!replay.validity.includes("FFA")) {
                    value += "Team " + p.team + "\n";
                }

                value += "Score: " + p.score + "\n";
                if (p.ai) {
                    pNameString = "AI " + pNameString;
                }

                embedMes["embed"].fields.push({"name": pNameString, "value": value, "inline": true});

            }

            callback(embedMes);
            return;
        } else {
            callback("Replay not found.");
            return;
        }

    });
}

function fetchLadderPool(apiUrl, callback) {

    utils.httpFetch(apiUrl + 'ladder1v1Map?include=mapVersion.map', function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }

        const data = JSON.parse(d);
        if (data != undefined && data.included != undefined) {

            let maps = {};
            const inc = data.included;

            for (let i = 0; i < inc.length; i++) {
                let thisData = inc[i];
                let id = "";
                switch (thisData.type) {
                    default:
                        continue;
                        break;

                    case "mapVersion":
                        id = thisData.relationships.map.data.id;
                        if (maps[id] == undefined) {
                            maps[id] = {};
                        }

                        maps[id].imgUrl = thisData.attributes.thumbnailUrlSmall.replace(/( )/g, "%20");
                        maps[id].mapVersion = thisData.attributes.version;
                        maps[id].mapSize = ((thisData.attributes.width / 512) * 10) + "x" + ((thisData.attributes.height / 512) * 10) + " km";
                        break;

                    case "map":
                        id = thisData.id;
                        if (maps[id] == undefined) {
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
            };

            const keys = Object.keys(maps);
            for (let i = 0; i < keys.length; i++) {
                const id = keys[i];
                const m = maps[id];

                embedMes["embed"].fields.push({
                    "name": m.mapName + " [" + m.mapVersion + "]",
                    "value": m.mapSize,
                    "inline": true
                });
            }

            callback(embedMes);
            return;

        } else {
            callback("Could not retrieve map pool.");
            return;
        }

    });
}

function fetchMap(mapNameOrId, apiUrl, callback) {

    let filter = 'displayName=="' + mapNameOrId + '"';
    if (utils.isNumeric(mapNameOrId) && !isNaN(parseFloat(mapNameOrId))) {
        filter = 'id==' + mapNameOrId + '';
    }
    const fetchUrl = apiUrl + 'map?filter=' + filter + '&page[size]=1&include=versions,author';

    utils.httpFetch(fetchUrl, function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }

        const data = JSON.parse(d);
        if (data != undefined && data.included != undefined) {

            let map = {};
            map.author = "Unknown";

            const mapData = data.data[0];
            const includes = data.included;

            for (let i = 0; i < includes.length; i++) {
                let thisData = includes[i];
                switch (thisData.type) {
                    default:
                        continue;
                        break;

                    case "mapVersion":
                        map.imgUrl = thisData.attributes.thumbnailUrlLarge.replace(/( )/g, "%20");
                        map.version = thisData.attributes.version;
                        map.size = ((thisData.attributes.width / 512) * 10) + "x" + ((thisData.attributes.height / 512) * 10) + " km";
                        map.description = thisData.attributes.description.replace(/<\/?[^>]+(>|$)/g, "");
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
                    "author": {
                        "name": "" + map.displayName + " (id #" + map.id + ")",
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
            };

            if (map.downloadUrl != undefined) {
                embedMes.embed.url = map.downloadUrl.replace(/ /g, "%20");
                embedMes.embed.author.url = map.downloadUrl.replace(/ /g, "%20");
            }

            callback(embedMes);
            return;

        } else {
            callback("Could not find map");
            return;
        }

    });
}

// Initialiaz map watching
function initializeMapWatching(settings, client) {
    setInterval(function () {
        // TODO: await fetchMapVersions
        fetchMapVersions(settings["map-check-page-size"], db, settings["urls"]["data"], function (message) {
            client.guilds.forEach(function (guildName, guildId) {
                const channels = utils.getSpecifics({"id": guildId, "name": guildName})["map-watch-channels"];
                for (let i = 0; i < channels.length; i++) {
                    const channel = client.channels.get(channels[i]);
                    if (channel !== undefined) {
                        sendMessage(channel, message);
                    }
                }
            })
        });
    }, settings["map-check-interval"] * 1000);
}

async function fetchMapVersions(pageSize, db, apiUrl, callback) {

    const fetchUrl = apiUrl + 'mapVersion?page[size]=' + pageSize + '&include=map,map.author&sort=-createTime';
    utils.log("Fetching new map versions", "++");
    utils.httpFetch(fetchUrl, async function (d) {
        if (Number.isInteger(d)) {
            utils.log("Server returned the error `" + d + "`.", "XX");
            return;
        }

        try {
            const data = JSON.parse(d);
            if (data != undefined && data.included != undefined) {

                for (let i = 0; i < data.data.length; i++) {
                    const mapVersionData = data.data[i];
                    const includes = data.included;

                    let mapVersion = {};
                    mapVersion.id = mapVersionData.id;
                    const exists = await utils.dbFetchAsync(db, "SELECT id FROM watched_maps WHERE map_version_id=" + mapVersion.id + ";");
                    if (exists) {
                        utils.log("Skipped map " + mapVersionData.id + " - already in the database", "++");
                        continue;
                    }
                    mapVersion.author = "Unknown";
                    mapVersion.imgUrl = mapVersionData.attributes.thumbnailUrlLarge.replace(/( )/g, "%20");
                    mapVersion.version = mapVersionData.attributes.version;
                    mapVersion.size = ((mapVersionData.attributes.width / 512) * 10) + "x" + ((mapVersionData.attributes.height / 512) * 10) + " km";
                    mapVersion.description = mapVersionData.attributes.description.replace(/<\/?[^>]+(>|$)/g, "");
                    mapVersion.downloadUrl = mapVersionData.attributes.downloadUrl;
                    mapVersion.maxPlayers = mapVersionData.attributes.maxPlayers;
                    mapVersion.ranked = mapVersionData.attributes.ranked;
                    mapVersion.mapId = mapVersionData.relationships.map.data.id;
                    mapVersion.createTime = mapVersionData.attributes.createTime;
                    mapVersion.authorId = 0;

                    for (let j = 0; j < includes.length; j++) {
                        let thisData = includes[j];
                        switch (thisData.type) {
                            default:
                                continue;
                                break;

                            case "map":
                                if (mapVersion.mapId == thisData.id) {
                                    mapVersion.displayName = thisData.attributes.displayName;
                                    if (thisData.relationships.author.data) mapVersion.authorId = thisData.relationships.author.data.id;
                                }
                                break;

                            case "player":
                                if (mapVersion.authorId == thisData.id) {
                                    mapVersion.author = thisData.attributes.login;
                                }
                                break;
                        }
                    }

                    let embedMes = {
                        "embed": {
                            "title": mapVersion.displayName + " (Version " + mapVersion.version + ")",
                            "description": mapVersion.description,
                            "color": 0xFF0000,
                            "author": {
                                "name": "" + mapVersion.displayName + " (id #" + mapVersion.id + ")",
                                "url": mapVersion.downloadUrl
                            },
                            "image": {
                                "url": mapVersion.imgUrl
                            },
                            "fields": [
                                {
                                    "name": "Size",
                                    "value": mapVersion.size,
                                    "inline": true
                                },
                                {
                                    "name": "Max players",
                                    "value": mapVersion.maxPlayers,
                                    "inline": true
                                },
                                {
                                    "name": "Ranked",
                                    "value": mapVersion.ranked,
                                    "inline": true
                                },
                                {
                                    "name": "Created at",
                                    "value": mapVersion.createTime,
                                    "inline": true
                                },
                                {
                                    "name": "Original map author",
                                    "value": mapVersion.author,
                                    "inline": true
                                }
                            ]
                        }
                    };

                    if (mapVersion.downloadUrl != undefined) {
                        embedMes.embed.url = mapVersion.downloadUrl.replace(/ /g, "%20");
                        embedMes.embed.author.url = mapVersion.downloadUrl.replace(/ /g, "%20");
                    }
                    await utils.dbRunAsync(db, "INSERT INTO watched_maps (map_version_id) VALUES (" + mapVersion.id + ");");
                    callback(embedMes);
                }
            }
        } catch (e) {
            utils.log("Error when trying to JSON parse server's response", "XX");
            console.log(e);
        }
    });
}

function fetchWikiArticle(searchTerm, wikiUrl, callback) {

    utils.httpFetch(wikiUrl + 'api.php?action=query&list=search&srsearch=' + searchTerm + '&format=json&srlimit=1&srwhat=title', function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }

        const data = JSON.parse(d);
        if (data != undefined && data.query != undefined && data.query.searchinfo.totalhits > 0) {
            const hit = data.query.search[0]; //For multiple results, will have to tweak this in a for loop.

            let embedMes = {
                "content": "Results for search term \"" + searchTerm + "\" :",
                "embed": {
                    "title": "**Click here to access wiki page**",
                    "url": wikiUrl + "index.php?title=" + hit.title.replace(/( )/g, "%20") + "",
                    "description": hit.title,
                    "color": 0xFF0000,
                    "thumbnail": {
                        "url": wikiUrl + "images/icon.png"
                    },
                    "fields": []
                }
            };

            callback(embedMes);
        } else {
            callback("No results for the term \"" + searchTerm + "\"");
            return;
        }

    });
}

function fetchUnitData(unitID, dbAddress, callback) {
    //Character escaping
    const webAddress = dbAddress;

    utils.httpFetch(webAddress + 'api.php?searchunit=' + unitID + '', function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }

        const data = JSON.parse(d);

        if (data != undefined && data.BlueprintType !== undefined && data.BlueprintType === "UnitBlueprint") {

            ////NAME FORMAT
            let cuteName = '';
            if (data.General.UnitName !== undefined) {
                cuteName = '"' + data.General.UnitName.replace(/<{1}[^<>]{1,}>{1}/g, "") + '" ';
            }

            let unit = {
                id: data.Id,
                name: '' + cuteName + '' + data.Description.replace(/<{1}[^<>]{1,}>{1}/g, ""),
                previewUrl: webAddress + 'res/img/preview/' + data.Id + '.png',
                strategicUrl: webAddress + 'res/img/strategic/' + data.StrategicIconName + '_rest.png',
                faction: data.General.FactionName,
            };

            let embedMes = {
                "embed": {
                    "title": "**Click here to open unitDB**",
                    "description": "" + unit.faction + " - " + unit.id, // <:"+(unit.faction.toLowerCase())+":"+message.client.emojis.findKey("name",(unit.faction.toLowerCase()))+">
                    "url": webAddress + 'index.php?id=' + unit.id,
                    "color": utils.getFactionColor(unit.faction),
                    "thumbnail": {
                        "url": unit.previewUrl
                    },
                    "author": {
                        "name": unit.name,
                        "url": webAddress + 'index.php?id=' + unit.id,
                        "icon_url": unit.strategicUrl
                    },
                    "fields": []
                }
            };
            callback(embedMes);

        } else {
            callback("Unit not found");
            return;
        }
    });
}

/// Fetches clan info and formats it as an embed message
function fetchClan(clanNameOrTag, apiUrl, callback) {
    utils.httpFetch(apiUrl + 'clan?filter=name=="' + clanNameOrTag + '",tag=="' + clanNameOrTag + '"&include=memberships.player&fields[player]=login&fields[clanMembership]=createTime,player&fields[clan]=name,description,websiteUrl,createTime,tag,leader', function (d) {
        if (Number.isInteger(d)) {
            callback("Server returned the error `" + d + "`.");
            return;
        }
        const data = JSON.parse(d);

        if (data.data != undefined && data.data.length > 0) {

            let clan = {
                id: data.data[0].id,
                name: data.data[0].attributes.name + " [" + data.data[0].attributes.tag + "]",
                createTime: data.data[0].attributes.createTime,
                description: data.data[0].attributes.description,
                websiteUrl: data.data[0].attributes.websiteUrl,
                leaderId: data.data[0].relationships.leader.data.id,
                users: {},
                leader: "Unknown"
            }

            const inc = data.included;

            for (let i = 0; i < inc.length; i++) {
                let thisData = inc[i];
                switch (thisData.type) {
                    default:
                        continue;
                        break;

                    case "player":
                        if (clan.users[thisData.id] == undefined) {
                            clan.users[thisData.id] = {}
                        }
                        clan.users[thisData.id].name = (thisData.attributes.login);
                        if (thisData.id == clan.leaderId) {
                            clan.users[thisData.id].leader = true;
                        } else {
                            clan.users[thisData.id].leader = false;
                        }
                        break;

                    case "clanMembership":
                        const playerId = thisData.relationships.player.data.id;
                        if (clan.users[playerId] == undefined) {
                            clan.users[playerId] = {}
                        }
                        clan.users[playerId].joinedAt = utils.formattedDate(new Date(Date.parse(thisData.attributes.createTime)));

                        break;
                }
            }

            if (clan.description == null || clan.description == "") {
                clan.description = "None";
            }


            let embedMes = {
                "content": "Clan info for [" + clanNameOrTag + "]",
                "embed": {
                    "title": "ID : " + clan.id + "",
                    "color": 0xFF0000,
                    "author": {
                        "name": clan.name,
                        "url": clan.websiteUrl
                    },
                    "fields": [
                        {
                            "name": "Created",
                            "value": clan.createTime,
                            "inline": true
                        },
                        {
                            "name": "URL",
                            "value": clan.websiteUrl,
                            "inline": true
                        },
                        {
                            "name": "Clan size",
                            "value": Object.keys(clan.users).length,
                            "inline": true
                        },
                        {
                            "name": "Description",
                            "value": clan.description,
                        }
                    ]
                }
            }

            const userArr = Object.keys(clan.users);
            if (userArr.length > 0) {
                for (i = 0; i < userArr.length; i++) {
                    let name = clan.users[userArr[i]].name;
                    let sub = clan.users[userArr[i]].joinedAt;
                    if (clan.users[userArr[i]].leader === true) {
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
        } else {
            callback("Requested clan does not exist.");
            return;
        }

    });
}



module.exports = {
    initializeMapWatching,
    fetchUnitData,
    fetchWikiArticle,
    fetchMap,
    fetchLadderPool,
    fetchReplay,
    fetchClan,
};
