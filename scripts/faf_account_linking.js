//UTILS
const utils = require('./utility.js');

/// Libraries
const request = require('request');
const express = require('express');
const fs = require('fs');
const app = express();

const fafCredentials = JSON.parse(fs.readFileSync('../_private/faf_credentials.json'));
const settings = JSON.parse(fs.readFileSync('../configuration/settings.json'));

const clientId = fafCredentials.clientId;
const clientSecret = fafCredentials.clientSecret;
const selfUrl = 'http://rk.sytes.net:3001/auth';
/*
let waitingForLink

function linkPlayer(author, fafName){
	
	
}	

/// Hosting 
app.get('/auth', function (req, res) {
	const code = req.query.code;
	if (code != undefined){
		res.send('You can now close this page.');	
		utils.log("Received connexion code :"+code, 'DD');
		request({
			url: settings.urls.api+'oauth/token',
			method: 'POST',
			headers : {
				"Authorization" : "Basic "+new Buffer(clientId + ":" + clientSecret).toString("base64")
			},
		  form: {
			'grant_type': 'authorization_code',
			'redirect_uri': selfUrl,
			'code': code,
			'client_id': clientId,
			'client_secret': clientSecret
		  }
		}, function(err, res) {
			
			if (err){
				console.log("ERR : "+err);
			}
			const json = JSON.parse(res.body);
			utils.log("Access Token:", json.access_token,'DD');
			utils.log("Fetching Me....", 'DD');
		  
			
			request({
				url: settings.urls.api+'me',
				method: 'GET',
				headers : {
					"Authorization" : "Bearer "+json.access_token
				}
			},
			function(err, res) {
				if (err){
					console.log("ERR: "+err);
				}
				const body = res.body;
				const response = JSON.parse(body);
				utils.log("Name : "+response.data.attributes.login, 'DD');
				utils.log("ID : "+response.data.id, 'DD');
				utils.log("Adding into the database...", 'DD');
				/// DATABASE ADD
				utils.log("Successfully linked "+response.data.attributes.login+" with user "+author.username, "FAF-LINKER");
			});
		});
	}
	else{
		res.send('Error while linking the accounts.');	
	}
});
app.get('/token', function (req, res) {
	
});
app.listen(3001, function () {
  console.log('Listening on port 3001!');
  console.log('Go right there : ');
  console.log('https://api.faforever.com/oauth/authorize?client_id=03caee76-e0ef-4188-b622-698221c689ac&response_type=code&redirect_uri=http%3A%2F%2Frk.sytes.net%3A3001%2Fauth');
})
*/