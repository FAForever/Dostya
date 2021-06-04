// Scripts
const utils = require("./scripts/utility.js");
const discord_client = require("./scripts/discord_uplink.js").client;
const irc = require("./scripts/behavior/irc.js");
const settings = require("./configuration/settings.json");

/// Configuration
const privateDir = "./_private";
const tokenPath = privateDir + "/token.json";

utils.checkToken(privateDir, tokenPath);
const token = require(tokenPath);

utils.log("Dostya launched ! Preparing...");

//ON EXCEPTION
process.on("uncaughtException", function (err) {
    utils.log("-------------------------", "XX");
    utils.log("CRASH AVOIDED! \n" + err, "XX");
    console.log(err);
    utils.log("-------------------------", "XX");
});

process.on("SIGINT", function () {
    utils.log("SIGINT - Exiting", "XX")
    irc.stopIrc(settings, "Dostya killed from terminal");
    setTimeout(function () {
        process.exit()
    }, 1000);
});

discord_client.login(token.token).then(() => {
    utils.log("Dostya is on Discrod");
});
