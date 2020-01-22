const he = require('he');
const rss = require('../rss_feed.js');

let announcers = [];

/// Clears the announcers list
function cleanAnnouncers() {
    announcers = [];
}

/// Add to the list of announcer channels - channels that will receive RSS news
function addToAnnouncers(channelObject) {
    announcers.push(channelObject);
}


/// Initializes RSS articles fetching and announcer channels
function initializeRss(settings) {
    rss.initialize(settings);
    rss.status.on('newArticle', function (article) {
        let message = '';
        message += '**' + he.decode(article.title) + '** - (' + article.author + ')' + '\n';
        message += article.link + '\n\n';
        // Uncommented, the following line will display the news content decoded.
        //message += he.decode(utils.stripTags(article.description.replace(/<br \/>/g, '\n')))+'\n';
        message += '\n(Published ' + article.pubDate + ')';

        for (let k in announcers) {
            const announcer = announcers[k];
            const limit = 1999; // Discord messages are limited to 2000 characters
            for (i = 0; i < message.length / limit; i += 1) {
                let cut = message.substr(i * limit, (i + 1) * limit);
                sendMessage(announcer, cut);
            }
        }
    });
}

module.exports = {
    initializeRss,
    addToAnnouncers,
    cleanAnnouncers,
};
