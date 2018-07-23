
const fakeGuild = {name: 'RSS-WATCHER', id: '0002'};
const Watcher = require('rss-watcher');
const utils = require('./utility.js');

const EventEmitter = require('events');
const status = new EventEmitter();

function initialize(settings){

    const watcher = new Watcher(settings.urls.rss)
    
    watcher.on('new article', function(article){
      utils.log('RSS feed watcher caught a new article.', '--', fakeGuild);
      status.emit('newArticle', article);
    });

    watcher.on('error', function(err){
        utils.log('RSS feed watcher encountered an error. Follows :', 'WW', fakeGuild);
        console.log(err);
    });

    watcher.run(function(err,articles){
        if (err){
            utils.log('RSS feed watcher encountered an error at initialization. Follows :', 'WW', fakeGuild);
            console.log(err);
        }
    });
}

module.exports = {
    initialize:
    function(settings){
        return initialize(settings);
    },
    status:status
}