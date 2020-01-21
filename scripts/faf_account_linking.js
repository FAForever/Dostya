//UTILS
const utils = require('./utility.js');
const fakeGuild = {name: 'ACC-LINKER', id: '0001'};

/// Libraries
const getIP = require('external-ip')();
const request = require('request');
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const app = express();
const crypto = require('crypto');

const session = require('express-session');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const path = require('path');

const credentialsPath = process.cwd() + '/_private/session.json';
try {
    fs.accessSync(credentialsPath);
} catch (e) {
    fs.writeFileSync(credentialsPath, JSON.stringify({
        "clientSecret": "ABC",
        "clientId": "DEF",
        "sessionSecret": "GHI"
    }));
}
const fafCredentials = require(credentialsPath);
utils.log("Loaded client ID " + fafCredentials.clientId + "", "--", fakeGuild);
const settings = require(process.cwd() + '/configuration/settings.json');

const port = 3003;
let server;
let currentTokens = {};
let addr = settings.urls.auth;
let callbackUrl = 'http://' + addr + ':' + port + '/auth';
/*
getIP((err, result) => {
    if (err) {
        // every service in the list has failed
        utils.log("Could not resolve host IP", "WW", fakeGuild);
        throw err;
    }
    ip = result;
    callbackUrl = 'http://'+ip+':'+port+'/auth';
    utils.log("Found ip : "+ip+"", "--", fakeGuild);
});
*/
const EventEmitter = require('events');
const status = new EventEmitter();

const clientId = fafCredentials.clientId;
const clientSecret = fafCredentials.clientSecret;
const sessionSecret = fafCredentials.sessionSecret;

function generateRandomToken() {
    return crypto.randomBytes(80).toString('hex');
}

async function start(discordId) {
    let token = generateRandomToken();
    while (currentTokens[token]) {
        token = generateRandomToken();
    }
    currentTokens[token] = discordId;

    // Invalidate token after 30 seconds
    setTimeout(() => {
        status.emit('expired', currentTokens[token]);
        delete currentTokens[token];
        // No more active tokens
        if (Object.keys(currentTokens).length === 0 && isLinking()) {
            server.close();
            cleanListeners();
            utils.log('Closed web server.', '--', fakeGuild);
        }
    }, settings['link-cooldown'] * 1000);

    if (!isLinking()) {

        app.use(cookieParser());

        app.use(session({
                "secret": sessionSecret,
                "resave": true,
                "saveUninitialized": true
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
                const token = req.cookies['discordToken'];
                res.redirect('/token/' + token);
            }
        );
        app.get('/token/*',
            function (req, res, next) {
                const token = req.url.split('/token/')[1];
                if (req.isAuthenticated()) {
                    if (!currentTokens[token]) {
                        res.status(403).send('Token expired or does not exist.');
                        return;
                    }
                    const authorId = currentTokens[token];
                    const login = req.user.data.attributes.userName;
                    const id = req.user.data.attributes.userId;
                    status.emit('success', login, id, authorId);

                    delete currentTokens[token];

                    if (Object.keys(currentTokens).length === 0 && isLinking()) {
                        server.close();
                        cleanListeners();
                        utils.log('Closed web server.', '--', fakeGuild);
                    }
                } else {
                    res.cookie("discordToken", token)
                    res.redirect("/login");
                }
            }
        );

        app.get('/login', function (req, res) {
            res.redirect(settings.urls.api + "oauth/authorize?client_id=" + clientId + "&response_type=code&redirect_uri=" + encodeURIComponent(callbackUrl));
        });

        server = app.listen(port, function () {
            utils.log('Listening on port ' + port + '', '!!', fakeGuild);
        });
    }

    return 'http://' + addr + ':' + port + '/token/' + token;
}

function isLinking() {
    if (server == undefined) {
        return false;
    }
    return server.address() != null;
}

function cleanListeners() {
    status.removeAllListeners("success");
    status.removeAllListeners("expired");
}

module.exports = {
    status: status,
    start: function (discordId) {
        return start(discordId);
    },
    isLinking: function () {
        return isLinking();
    },
    cleanListeners: function () {
        return cleanListeners();
    }
}
