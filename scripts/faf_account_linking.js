//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'ACC-LINKER', id: '0001'};

/// Libraries
const getIP = require('external-ip')();
const request = require('request');
const express = require('express');
const fs = require('fs');
const app = express();

const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const path = require('path');

const credentialsPath = process.cwd()+'/_private/session.json';
try{
    fs.accessSync(credentialsPath);
}
catch(e){
    fs.writeFileSync(credentialsPath, JSON.stringify({'clientSecret':'ABC','clientId':'DEF','sessionSecret':'GHI'}));
}
const fafCredentials = require(credentialsPath);
utils.log('Loaded client ID '+fafCredentials.clientId+'', '--', fakeGuild);
const settings = require(process.cwd()+'/configuration/settings.json');

const port = 3003;
let server;
let addr = settings.urls.auth;
let callbackUrl = 'http://' + addr + ':' + port + '/auth';
/*
getIP((err, result) => {
    if (err) {
        // every service in the list has failed
        utils.log('Could not resolve host IP', 'WW', fakeGuild);
        throw err;
    }
    ip = result;
    callbackUrl = 'http://'+ip+':'+port+'/auth';
    utils.log('Found ip : '+ip+'', '--', fakeGuild);
});
*/
const EventEmitter = require('events');
const crypto = require('crypto');
const status = new EventEmitter();

const clientId = fafCredentials.clientId;
const clientSecret = fafCredentials.clientSecret;
const sessionSecret = fafCredentials.sessionSecret;

let server_started = false;
let current_tokens = {};


/**
 * generateRandomToken - Create a randomized token
 * for each player. Should be unique.
 *
 * @return {string}  Randomized token
 */
function generateRandomToken() {
    return crypto.randomBytes(80).toString('hex');
}

function start (){
    server_started = true;

    app.use(session({
        'secret': sessionSecret,
        'resave': true,
        'saveUninitialized': true
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function (user, done) {
      done(null, JSON.stringify(user));
    });

    passport.deserializeUser(function (user, done) {
      done(null, JSON.parse(user));
    });

    passport.use(
      new OAuth2Strategy({
          authorizationURL: settings.urls.api + 'oauth/authorize',
          tokenURL: settings.urls.api + 'oauth/token',
          clientID: clientId,
          clientSecret: clientSecret,
          callbackURL: callbackUrl
        },
        function (accessToken, refreshToken, profile, done) {
          request.get(
            {
              url: settings.urls.api + 'me',
              headers: {'Authorization': 'Bearer ' + accessToken}
            },
            function (e, r, body) {
              if (r.statusCode !== 200) {
                return done(null);
              }
              let user = JSON.parse(body);
              user.data.attributes.token = accessToken;
              return done(null, user);
            }
          );
        })
    );

    app.get('/auth',
      passport.authenticate('oauth2'),
      function (req, res) {
        res.redirect('/');
      }
    );
    app.get('/token/*',
      function (req, res, next) {
        if (req.isAuthenticated()) {
            let token = req.url.split('/token/')[1];

            if (!current_tokens[token]) {
                res.send('Token expired or does not exist.', 403);
                return;
            }

            let author_id = current_tokens[token];

            const login = req.user.data.attributes.login;
            const id = req.user.data.id;
            status.emit('success', login, id, author_id);

            delete current_tokens[token];
        } else {
            res.redirect('/login');
        }
      }
    );

    app.get('/login', function (req, res) {
      res.redirect(settings.urls.api + 'oauth/authorize?client_id=' + clientId + '&response_type=code&redirect_uri=' + encodeURIComponent(callbackUrl));
    });

    server = app.listen(port, function () {
      utils.log('Listening on port '+ port + '', '!!', fakeGuild);
    });
}

function cleanListeners(){
    status.removeAllListeners("success");
    status.removeAllListeners("expired");
}


module.exports = {
    status: status,
    start: () => {
        if (!server_started) {
            start();
        }
    },
    getAddress: (id) => {
        let token = generateRandomToken();
        current_tokens[token] = id;

        // Invalidate token after 30 seconds
        setTimeout(() => {
            delete current_tokens[token];
            status.emit('expired');

            // No more active tokens
            if (Object.keys(current_tokens).length === 0) {
                server.close();
                cleanListeners();
            }
        }, 30 * 1000);

        return 'http://' + addr + ':' + port + '/token/' + token;
    },
    cleanListeners: () => cleanListeners()
}
