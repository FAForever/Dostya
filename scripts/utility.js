// EXPORTS are AT EOF
const settings = require(process.cwd() + "/configuration/settings.json");
const GUILD_TRACKER_FILENAME = "tracker.txt";
const GUILD_SPECIFICS_FILENAME = "specifics.json";
const identitiesPath = "./_private/identities";

const fs = require("fs");
const mkdirp = require("mkdirp");
const https = require("https");
const http = require("http");

const defaultSpecifics = settings["default-specifics"];

let FACTIONS = ["uef", "aeon", "cybran", "seraphim", "random"];
let FACTION_COLORS = {
    "uef": 0x0000FF,
    "aeon": 0x00FF00,
    "cybran": 0xFF0000,
    "seraphim": 0xFFFF00,
    "nomad": 0xFF9900
};

const FORBIDDEN_LOG_CHARS = ["*", "/"];
const LOG_GUILD_LENGTH = 8;

/**
 * Logging to output
 *
 * @param {string} message Message to log
 * @param {string} type Two letters "type", like WW - warning
 * @param {Object=} guild message initiator
 */
function log(message, type = "--", guild = undefined) {
    let guildName = " ".repeat(LOG_GUILD_LENGTH);

    if (guild) {
        guildName = guild.name || guild;
        FORBIDDEN_LOG_CHARS.forEach((e) => {
            guildName = guildName.split(e).join("."); // replace all forbidden chars
        });
    }

    // some bash color magic
    const guildColor = 30 + 60 * uniqueNumber(guildName, 2) + uniqueNumber(guildName, 7);

    if (settings["debug-mode"]) {
        console.log(
            "\x1B[2m[" + time() + "]\x1B[0m \x1B[" + guildColor + "m[" + makeLong(guildName, LOG_GUILD_LENGTH) +
            "]\x1B[0m \x1B[7m[" + type + "]\x1B[27m " +
            message
        );
        return;
    }

    if (type !== "++" && (type !== "DD" || settings["debug-mode"])) {
        console.log(`[${time()}] [${makeLong(guildName, LOG_GUILD_LENGTH)}] [${type}] ${message}`);
    }
}

function isNumeric(str) {
    return !/[^0-9]/.test(str);
}

function getIdFromString(strReplyUser) {
    if (isNumeric(strReplyUser)) {
        return strReplyUser;
    }
    let thisUserId = strReplyUser.substring(2, strReplyUser.length - 1);
    if (thisUserId.charAt(0) === "!") {
        thisUserId = thisUserId.substring(1, thisUserId.length);
    }
    return thisUserId;
}

function track(guildMember) {
    const fullPath = getTrackerFile(guildMember.guild);

    if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, time() + " - Dostya user tracking start\r\n", {"encoding": "utf8"});
    }
    let trackerContent = fs.readFileSync(fullPath);
    fs.writeFileSync(fullPath, trackerContent + "\r\n[" + time() + "] " + guildMember.id + " - " + guildMember.user.username, {"encoding": "utf8"});
}

function getTrackerFile(guild) {
    return getGuildIdentityPath(guild) + "/" + GUILD_TRACKER_FILENAME;
}

function getSpecifics(guild) { // todo: to db
    const guildPath = getGuildIdentityPath(guild);
    if (!fs.existsSync(guildPath + "/" + GUILD_SPECIFICS_FILENAME)) {
        writeSpecifics(guild, defaultSpecifics);
    }
    let specifics = JSON.parse(fs.readFileSync(guildPath + "/" + GUILD_SPECIFICS_FILENAME));
    const keys = Object.keys(defaultSpecifics);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (specifics[key] === undefined) {
            specifics[key] = defaultSpecifics[key];
        }
    }
    return specifics;
}

function writeSpecifics(guild, specifics) {
    const guildPath = getGuildIdentityPath(guild);
    fs.writeFileSync(guildPath + "/" + GUILD_SPECIFICS_FILENAME, JSON.stringify(specifics));
}

function getGuildIdentityPath(guild) {
    if (!guild.name) {
        console.log(guild);
        throw Error("wtf?!");
    }

    const guildPath = identitiesPath + "/" + guild.id;
    if (!fs.existsSync(guildPath)) {
        mkdirp.sync(guildPath);
    }

    if (!fs.existsSync(guildPath + "/" + guild.name)) {
        fs.writeFile(guildPath + "/" + guild.name, guild.name, (error) => {
            log("error occured during getIdentityPath save");
        });
    }

    return guildPath;
}

function httpFetch(address, callback) {
    let isSecure = address.indexOf("https") === 0;
    let method = isSecure ? https.get : http.get;

    method(address, (res) => {
        let ok = false;
        switch (res.statusCode) {
            default:
                ok = true;
                break;

            case 400:
                log("[" + address + "] ==> Malformed request ?! 400 - doing nothing.", "WW");
                break;

            case 403:
                log("[" + address + "] ==> Access forbidden ?! 403 - doing nothing.", "WW");
                break;

            case 404:
                log("[" + address + "] ==> Server not found ?! 404 - doing nothing.", "WW");
                break;

            case 500:
                log("[" + address + "] ==> Server error ?! 500 - doing nothing.", "WW");
                break;

            case 504:
                log("[" + address + "] ==> Server error ?! 504 - doing nothing.", "WW");
                break;
        }

        if (ok) {
            let responseData = "";

            res.setEncoding("utf8");

            res.on("readable", function () {
                const chunk = this.read() || "";

                responseData += chunk;
            });

            res.on("end", function () {
                callback(responseData);
            });

        } else {
            callback(res.statusCode);
        }

    }).on("error", (e) => {
        log("[" + address + "] ==> HTTP request returned following error : [" + (e) + "]. Doing nothing.", "WW");
    });
}

function checkToken(privateDir, tokenPath) {
    const defaultTokenContent = "{\"token\": \"PutYourTokenHere\"}";

    if (!fs.existsSync(tokenPath) || fs.readFileSync(tokenPath) === defaultTokenContent) {
        if (!fs.existsSync(privateDir)) {
            fs.mkdirSync(privateDir);
        }
        fs.writeFileSync(tokenPath, defaultTokenContent);
        console.log("Hello and welcome to Dostya configuration.\n" +
            "To make Dostya work, you need to specify a TOKEN to be used by the bot. This token can be obtained through the developper panel on the discord.\n" +
            "Once you have it, put it into the " + tokenPath + " file and restart Dostya.");
        log("No token found -- Aborting", "XX")
        process.exit();
    }
}

function uniqueNumber(str, modulo) {
    let totalVal = 0;
    for (let i = 0; i < str.length; i++) {
        totalVal += str.charCodeAt(i);
    }
    totalVal = totalVal % modulo;
    return totalVal;
}

function makeLong(str, length) {
    let finalStr = str.substring(0, length).toUpperCase();
    const need = length - finalStr.length;
    for (let i = 0; i < need; i++) {
        finalStr += " ";
    }
    return finalStr;
}

function time() {
    return (new Date()).toISOString();
}

function getFaction(factionNumber) {
    return FACTIONS[factionNumber] || "";
}

function getFactionColor(faction) {
    return FACTION_COLORS[faction];
}

function emptyPromise() {
    let callbacks;
    let done = false;

    const p = new Promise((resolve, reject) => {
        callbacks = {resolve, reject};
    });

    p.done = () => done;
    p.resolve = (val) => {
        callbacks.resolve(val);
        done = true;
        return p;
    };
    p.reject = (val) => {
        callbacks.reject(val);
        done = true;
        return p;
    };

    return p;
}

function formattedDate(d = new Date) {
    let month = String(d.getMonth() + 1);
    let day = String(d.getDate());
    const year = String(d.getFullYear());

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return `${month}/${day}/${year}`;
}

function isAlphanumeric(str) {
    return !/[^a-zA-Z0-9]/.test(str);
}

function dbRunAsync(db, query) {
    return new Promise(function (resolve, reject) {
        db.run(query, function (error) {
            if (error) {
                log(error, "DD");
                reject(error);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

function dbFetchAsync(db, query) {
    return new Promise(function (resolve, reject) {
        db.get(query, function (error, row) {
            if (error) {
                log(error, "><");
                console.log(error);
                reject(error);
            } else {
                resolve(row);
            }
        });
    });
}

function readFileAsync(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, "utf8", function (error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}


//EXPORTS FOR SHARED USE
module.exports = {
    log,
    readFileAsync,
    dbRunAsync,
    dbFetchAsync,
    getIdFromString,
    track,
    httpFetch,
    httpFetch,
    getFactionColor,
    getFaction,
    isAlphanumeric,
    isNumeric,
    formattedDate,
    getTrackerFile,
    getSpecifics,
    writeSpecifics,
    emptyPromise,
    checkToken
};
