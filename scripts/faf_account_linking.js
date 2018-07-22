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
    fs.writeFileSync(credentialsPath, '{"clientSecret":"ABC","clientId":"DEF","sessionSecret":"GHI"}');
}
const fafCredentials = require(credentialsPath);
utils.log("Loaded client ID "+fafCredentials.clientId+"", "--", fakeGuild);
const settings = require(process.cwd()+'/configuration/settings.json');

const port = 3003;
let server;
let addr = settings.urls.auth; 
let callbackUrl = 'http://'+addr+':'+port+'/auth';
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

let timeout;

function start (){    
    clearTimeout(timeout);
    timeout = setTimeout(function(){
        status.emit('expired');
        server.close();
        utils.log('Closed web server.', '--', fakeGuild);
    }, 30000);
    
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
        res.redirect('/');
      }
    );
    app.get('/',
      function (req, res, next) {
        if (req.isAuthenticated()) {
          const login = req.user.data.attributes.login;
          const id = req.user.data.id;
          status.emit('success', login, id);
          server.close();
          utils.log('Closed web server.', '--', fakeGuild);
        } else {
          res.redirect("/login");
        }
      }
    );

    app.get('/login', function (req, res) {
      res.redirect(settings.urls.api + "oauth/authorize?client_id=" + clientId + "&response_type=code&redirect_uri=" + encodeURIComponent(callbackUrl));
    });

    server = app.listen(port, function () {
      utils.log('Listening on port '+port+'', '!!', fakeGuild);
    });
}

function isLinking(){
    if (server == undefined){
        return false;
    }
    return server.address() != null;
}

function cleanListeners(){
    status.removeAllListeners("success");
    status.removeAllListeners("expired");
}

module.exports = {
    status:status,
    start:function(){
        return start();
    },
    isLinking:function(){
        return isLinking();
    },
    getAddress:function(){
        return 'http://'+addr+':'+port+'/';
    },
    cleanListeners:function(){
        return cleanListeners();
    }
}
