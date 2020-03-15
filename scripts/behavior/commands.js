const utils = require("../utility");
const db = require("../db").db;
const settings = require("../../configuration/settings.json");
const {COMMANDS_MAP} = require("../behavior");

const COMMAND_SUCCESS = 0;
const COMMAND_COOL_DOWN = 1;
const COMMAND_UNKNOWN = 2;
const COMMAND_MISUSE = 3;
const COMMAND_FORBIDDEN = 4;

/**
 * Checks if a command has been restricted in that guild
 */
function isRestrictedCommand(str_command, guild) {
    const specs = utils.getSpecifics(guild);
    return specs.restricted.indexOf(str_command) > -1;
}


function onCommandFound(message) {
    for (let i = 0; i < settings.prefixes.length; i++) {
        const prefix = settings.prefixes[i];
        if (message.startsWith(prefix)) {
            message = message.replace(prefix, "").trim();
            break;
        }
    }

    for (let command in COMMANDS_MAP) {
        if (COMMANDS_MAP.hasOwnProperty(command) && message.startsWith(command)) {
            COMMANDS_MAP[command](command, commandArguments, message,  callback);
        }
    }
}

/**
 * Executes function if prefix is found
 */
function onPrefixFound(message, callback) {
    for (let i = 0; i < settings.prefixes.length; i++) {	// Check if message includes on of the prefixes
        if (!message.content.startsWith(settings.prefixes[i])) {
            continue;
        }

        let command = message.content.slice(settings.prefixes[i].length, message.content.length);
        let cmdArguments = command.split(" ");

        if (command.indexOf(" ") > -1) {
            const index = command.indexOf(" ");
            cmdArguments = command.substring(index + 1, command.length);
            command = command.substring(0, index);
        }

        command = command.toLowerCase();
        callback(command, cmdArguments);
    }
}

function flushMaps() {
    db.run("DELETE FROM watched_maps", function () {
        utils.log("Called 'flushmaps'");
    });
}

module.exports = {
    COMMAND_SUCCESS,
    COMMAND_COOL_DOWN,
    COMMAND_UNKNOWN,
    COMMAND_MISUSE,
    COMMAND_FORBIDDEN,

    flushMaps,
    isRestrictedCommand,
    onPrefixFound
};
