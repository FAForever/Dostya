const utils = require('./utility.js');
const fs = require("fs");
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(process.cwd() + '/_private/userdata.db');

// Initializes the database
function initializeDatabase(settings) {
    const migrationPath = process.cwd() + "/configuration/general_database_setup/";
    const files = fs.readdirSync(migrationPath);
    for (let k in files) {
        const file = files[k];
        if (file.endsWith(".sql")) {
            continue;
        }
        utils.log(`Running DB initialization script [${file}]`, 'DD');
        let data = fs.readFileSync(migrationPath + file, 'utf8');
        utils.dbRunAsync(db, data);
    }
}


console.log("initialized DB");

module.exports = {
    db,
    initializeDatabase,
};
