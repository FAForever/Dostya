const utils = require("../utility");
const discord = require("discord");

/// Adds a recording to play with a user-registered command.
function addRecord(guild, settings, key, message) {
    let guildSpecifics = utils.getSpecifics(guild);
    if (!guildSpecifics['recorded-messages']) {
        guildSpecifics['recorded-messages'] = {};
    }

    // Cloning existing record
    if (guildSpecifics['recorded-messages'][message]) {
        message = guildSpecifics['recorded-messages'][message];
    }
    guildSpecifics['recorded-messages'][key] = message;

    utils.writeSpecifics(guild, guildSpecifics);
    discord.logForModerators(guild, "Added recording [" + settings["prefixes"][0] + key + "] => " + message + "");
}

/// Deletes an user registered recording
function deleteRecord(guild, settings, key) {
    let guildSpecifics = utils.getSpecifics(guild);
    delete guildSpecifics['recorded-messages'][key];
    utils.writeSpecifics(guild, guildSpecifics);
    discord.logForModerators(guild, "Deleted recording [" + settings["prefixes"][0] + key + "]");
}

module.exports = {
    deleteRecord,
    addRecord,
};
