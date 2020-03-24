const fakeGuild = {name: 'RSS-WATCHER', id: '0002'};
const Watcher = require('rss-watcher');
const fs = require('fs');
const utils = require('./utility.js');
const pubFilePath = process.cwd() + '/_private/publications.json';
let publications = {};

const EventEmitter = require('events');
const status = new EventEmitter();

function initialize(settings) {

    if (!fs.existsSync(pubFilePath)) {
        fs.writeFile(pubFilePath, JSON.stringify(publications), 'utf8', function (err) {
            if (err) {
                utils.log("RSS Fatal error on initialization", "><", fakeGuild);
                console.log(err);
            }
            initialize(settings);
        });
    } else {
        try {
            publications = require(pubFilePath);
        } catch (e) {
            utils.log("RSS Fatal error on initialization", "><", fakeGuild);
            fs.unlink(pubFilePath, function (err) {
                if (err) {

                } else {
                    utils.log("RSS publications file deleted", "!!", fakeGuild);
                }
            });
            console.log(e);
            return;
        }
        const watcher = new Watcher(settings.urls.rss)
        utils.log('RSS feed watcher listening for ' + settings.urls.rss, '--', fakeGuild);

        watcher.on('new article', function (article) {
            if (!hasBeenPublished(article)) {
                utils.log('RSS feed watcher caught a new article.', '--', fakeGuild);
                status.emit('newArticle', article);
                addToPublished(article);
            }
        });

        watcher.on('error', function (err) {
            utils.log('RSS feed watcher encountered an error. Follows :', 'WW', fakeGuild);
            console.log(err);
        });

        watcher.run(function (err, articles) {
            for (k in articles) {
                const article = articles[k];
                addToPublished(article);
            }
            if (err) {
                utils.log('RSS feed watcher encountered an error at initialization. Follows :', 'WW', fakeGuild);
                console.log(err);
            }
        });
    }
}

function addToPublished(article) {
    publications[article.title] = true;
    fs.writeFile(pubFilePath, JSON.stringify(publications), 'utf8', function (err) {
        if (err) {
            utils.log("RSS Fatal error on adding article [" + article.title + "]", "><", fakeGuild);
            console.log(err);
        }
    });
}

function hasBeenPublished(article) {
    return publications[article.title] === true;
}

module.exports = {
    initialize:
        function (settings) {
            return initialize(settings);
        },
    status: status
}