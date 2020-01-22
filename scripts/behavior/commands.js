const utils = require("../utility");
const db = require("../db").db;

const COMMAND_SUCCESS = 0;
const COMMAND_COOL_DOWN = 1;
const COMMAND_UNKNOWN = 2;
const COMMAND_MISUSE = 3;
const COMMAND_FORBIDDEN = 4;

/// Checks if a command has been restricted in that guild
function isRestrictedCommand(str_command, guild) {
    const specs = utils.getSpecifics(guild);
    return specs.restricted.indexOf(str_command) > -1;
}


/// Executes function if prefix is found
function onPrefixFound(message, settings, utils, callback) {
    for (let i = 0; i < settings.prefixes.length; i++) {	//Check if message includes on of the prefixes
        const thisPref = settings.prefixes[i];
        let validPref = true;
        let command;
        for (let j = 0; j < thisPref.length; j++) {
            let thisChar = message.content.charAt(j);
            let thisPrefChar = thisPref.charAt(j);
            if (thisChar !== thisPrefChar) {
                validPref = false;
            }
        }
        if (validPref) {
            command = message.content.slice(settings.prefixes[i].length, message.content.length);	/// Removing prefix

            let arguments = null;

            if (command.indexOf(" ") > -1) {
                const index = command.indexOf(" ");
                arguments = command.substring(index + 1, command.length);
                command = command.substring(0, index);
            }

            command = command.toLowerCase();
            callback(command, arguments);
        }
    }
}

function flushmaps() {
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

    flushmaps,
    isRestrictedCommand,
    onPrefixFound
};
