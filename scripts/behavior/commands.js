const utils = require("../utility");
const db = require("../db").db;

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
};
