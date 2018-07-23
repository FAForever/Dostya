//EXPORTS AT EOF
const settings = require(process.cwd()+"/configuration/settings.json");
const trackerfile = "tracker.txt";
const specificsFile = "specifics.json";
const logPath = "./_private/logs";
const identitiesPath = "./_private/identities";

const fs = require("fs");
const mkdirp = require("mkdirp");
const https = require('https');
const http = require('http');

const defaultSpecifics = settings["default-specifics"];

////////////////
/// LOG FUNCTION
////////////////
function log(message, type="--", guild=undefined){
	const logGuildNameLength = 8;
	let guildName = "";
	let debug = false;
	
	for (var i = 0; i< logGuildNameLength; i++){
		guildName += " ";
	}
	if (guild != undefined){
		if (typeof guild == "string"){
			guildName = guild;
		}
		else{
			guildName = guild.name;
		}
		const forbiddenChars = ["*", "/"];
	
		for (let i = 0; i<forbiddenChars.length; i++){
			while(guildName.indexOf(forbiddenChars[i]) > -1){
				guildName = guildName.replace(forbiddenChars[i], ".");
			}
		}
	}
	guildColor = uniqueNumber(guildName, 7);
	guildColorType = uniqueNumber(guildName, 2);
	guildColor = 30 + 60*guildColorType + guildColor;
	const consoleString = "\x1B[2m["+time()+"]\x1B[0m \x1B["+guildColor+"m["+makeLong(guildName,logGuildNameLength)+"]\x1B[0m \x1B[7m["+type+"]\x1B[27m "+message;
	if (type != '++' && (type !="DD" || settings['debug-log'])){
		console.log(consoleString);
	}
	if (guild && settings["write-logs"]){
		const fullPath = getCurrentLogPath();
		const path = logPath+"/";
		
		if (!fs.existsSync(path)){
			mkdirp.sync(path);
		}
		if (!fs.existsSync(fullPath)){
			fs.writeFileSync(fullPath, "- Dostya Log Start -", {"encoding":'utf8'});
		}
		let logContent = fs.readFileSync(fullPath);			
		const logString = "["+time()+"] ["+makeLong(guildName,logGuildNameLength*2)+"] ["+type+"] "+message;
		fs.writeFileSync(fullPath, logContent+"\r\n"+logString, {"encoding":'utf8'});
	}
	/*
	if (debugChat && consoleString){
		globalChatStamp[guild] += "["+type+"] "+message+"\r\n";
	}
	*/
}

function getCurrentLogPath(){
	const path = logPath+"/";
	const fullPath = path+time(true)+".log";
	return fullPath;
}

function getIdFromString(str_reply_user){
	
	let thisUserId = str_reply_user.substring(2, str_reply_user.length-1);
	if (thisUserId.charAt(0) == "!"){
		thisUserId = thisUserId.substring(1, thisUserId.length);
	}
	return thisUserId;
}

function track(guildMember){
	/// Initialization
	
	const fullPath = getTrackerFile(guildMember.guild);
	
	if (!fs.existsSync(fullPath)){
		fs.writeFileSync(fullPath, time()+" - Dostya user tracking start\r\n", {"encoding":'utf8'});
	}
	let trackerContent = fs.readFileSync(fullPath);
	fs.writeFileSync(fullPath, trackerContent+"\r\n["+time()+"] "+guildMember.id+" - "+guildMember.user.username, {"encoding":'utf8'});
}

function getTrackerFile(guild){
	const guildPath = getIdentityPath(guild);
	return guildPath+"/"+trackerfile;
}
function getSpecifics(guild){
	const guildPath = getIdentityPath(guild);
	if (!fs.existsSync(guildPath+"/"+specificsFile)){
		writeSpecifics(guild, defaultSpecifics);
	}
	let specifics = JSON.parse(fs.readFileSync(guildPath+"/"+specificsFile));
	const keys = Object.keys(defaultSpecifics);
	for (let i = 0; i < keys.length; i++){
		const key = keys[i];
		if (specifics[key] == undefined){
			specifics[key] = defaultSpecifics[key];
		}
	}
	return specifics;
}
function writeSpecifics(guild, specifics){
	const guildPath = getIdentityPath(guild);
	fs.writeFileSync(guildPath+"/"+specificsFile, JSON.stringify(specifics));
}
function getIdentityPath(guild){
	const guildPath = identitiesPath+"/"+guild.id;
	if (!fs.existsSync(guildPath)){
		mkdirp.sync(guildPath);
	}
	if (!fs.existsSync(guildPath+"/"+guild.name)){
		fs.writeFile(guildPath+"/"+guild.name, guild.name, function(){});
	}
	return guildPath;
}

function httpFetch(address, function_callback){
	
	http.get(address, (res) => {
		//console.log('statusCode:', res.statusCode);
		//console.log('headers:', res.headers);
		let ok = false;
		switch (res.statusCode){
			default:
				ok = true;
				break;
				
			case 400:
				log("["+address+"] ==> Malformed request ?! 400 - doing nothing.", "WW");
				break;
				
			case 403:
				log("["+address+"] ==> Access forbidden ?! 403 - doing nothing.", "WW");
				break;
				
			case 404:
				log("["+address+"] ==> Server not found ?! 404 - doing nothing.", "WW");
				break;
				
			case 500:
				log("["+address+"] ==> Server error ?! 500 - doing nothing.", "WW");
				break;
		}
		
		if (ok){

			let d = '';

			res.setEncoding('utf8');

			res.on('readable', function () {
				const chunk = this.read() || '';

				d += chunk;
			});

			res.on('end', function () { function_callback(d); });
			
		}
		else{
			function_callback(res.statusCode);
		}
		
	}).on('error', (e) => {
		log("["+address+"] ==> HTTP request returned following error : ["+(e)+"]. Doing nothing.", "WW");
	});
}
function httpsFetch(address, function_callback){
   
   //Single HTTPS-GET should get us everything we need
   
	https.get(address, (res) => {
		
		let ok = false;
		switch (res.statusCode){
			default:
				ok = true;
				break;
				
			case 400:
				log("["+address+"] ==> Malformed request ?! 400 - doing nothing.", "WW");
				break;
				
			case 403:
				log("["+address+"] ==> Access forbidden ?! 403 - doing nothing.", "WW");
				break;
				
			case 404:
				log("["+address+"] ==> Server not found ?! 404 - doing nothing.", "WW");
				break;
				
			case 500:
				log("["+address+"] ==> Server error ?! 500 - doing nothing.", "WW");
				break;
		}
		
		if (ok){

			let d = '';

			res.setEncoding('utf8');

			res.on('readable', function () {
				const chunk = this.read() || '';

				d += chunk;
			});

			res.on('end', function () { function_callback(d); });
			
		}
		else{
			function_callback(res.statusCode);
		}
		
	}).on('error', (e) => {
		log("HTTPS request returned following error : ["+(e)+"]. Doing nothing.", "WW");
	});
}

//Utils i'll comment later
function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

function checkToken(privateDir,tokenPath){
    const defaultTokenContent = '{"token": "PutYourTokenHere"}';

    if (!fs.existsSync(tokenPath) || fs.readFileSync(tokenPath) == defaultTokenContent){
        if (!fs.existsSync(privateDir)){
            fs.mkdirSync(privateDir);
        }
        fs.writeFileSync(tokenPath, defaultTokenContent);
        console.log("Hello and welcome to Dostya configuration.\n"+
                    "To make Dostya work, you need to specify a TOKEN to be used by the bot. This token can be obtained through the developper panel on the discord.\n"+
                    "Once you have it, put it into the "+tokenPath+" file and restart Dostya.");
        log("No token found -- Aborting", "XX")
        process.exit();
    }
}

function uniqueNumber(str, modulo){
	totalVal = 0;
	for (var i = 0; i<str.length; i++){
		totalVal += str.charCodeAt(i);
	}
	totalVal = totalVal%modulo;
	return totalVal;
}

function makeLong (str, length){
	var finalStr = str.substring(0,length).toUpperCase();
	const need = length - finalStr.length;
	for (var i = 0; i<need; i++){
		finalStr += " ";
	}
	return finalStr;
}

function time(dayOnly=false) {
	let date = new Date();

	let hour = date.getHours();
	hour = (hour < 10 ? "0" : "") + hour;

	let min  = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;

	let sec  = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;

	let year = date.getFullYear();

	let month = date.getMonth() + 1;
	month = (month < 10 ? "0" : "") + month;

	let day  = date.getDate();
	day = (day < 10 ? "0" : "") + day;
	if (dayOnly){
		return day + "." + month + "." + year;
	}
	return day + "/" + month + "/" + year + " - " + hour + ":" + min + ":" + sec;

}
function invertColor(hex) {
	if (hex.indexOf('#') === 0) {
		hex = hex.slice(1);
	}
	// convert 3-digit hex to 6-digits.
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	if (hex.length !== 6) {
		log('Invalid HEX color : '+hex, 'WW', 'ERROR');
	}
	// invert color components
	var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
		g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
		b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
	// pad each with zeros and return
	return '#' + padZero(r) + padZero(g) + padZero(b);
}
function getFaction(int_fac){
	switch (int_fac){
		default:
			return "";
			break;
			
		case 1:
			return "uef"
			break;
		case 2:
			return "aeon"
			break;
		case 3:
			return "cybran"
			break;
		case 4:
			return "seraphim"
			break;
		case 5:
			return "random"
			break;
	}
}
function getFactionColor(str_fac){
	
	switch (str_fac.toLowerCase()){
			
		case "uef":
			return 0x0000FF;
			break;
		case "aeon":
			return 0x00FF00;
			break;
		case "cybran":
			return 0xFF0000;
			break;
		case "seraphim":
			return 0xFFFF00;
			break;
		case "nomad":
			return 0xFF9900;
			break;
	}
}

function emptyPromise(){
	  let callbacks;
	  let done = false;

	  const p = new Promise((resolve, reject) => {
		callbacks = { resolve, reject };
	  })

	  p.done = () => done;
	  p.resolve = (val) => {
		callbacks.resolve(val);
		done = true;
		return p;
	  }
	  p.reject = (val) => {
		callbacks.reject(val);
		done = true;
		return p;
	  }

	  return p;
}

function formattedDate(d = new Date) {
  let month = String(d.getMonth() + 1);
  let day = String(d.getDate());
  const year = String(d.getFullYear());

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return `${month}/${day}/${year}`;
}

function isAlphanumeric(str){
	if( /[^a-zA-Z0-9]/.test( str ) ) {
	   return false;
	}
	return true;     
}

function isNumeric(str){
	if( /[^0-9]/.test( str ) ) {
	   return false;
	}
	return true;     
}

function stripTags(str){
    if ((str===null) || (str==='')){
        return false;
    }
    else{
        str = str.toString();
    }
    return str.replace(/<[^>]*>/g, '');
}

//EXPORTS FOR SHARED USE
module.exports = {
   log: 
	function(message, type="--", guild){
		if (true || type !="DD"){
			log(message, type, guild);
		}
	},
	
	getIdFromString:
	function (str){
		return getIdFromString(str);
	},
	
	track:
	function (gm){
		return track(gm);
	},
	
	httpFetch:
	function (address, callback){
		return httpFetch(address, callback);
	},
	
	httpsFetch:
	function (address, callback){
		return httpsFetch(address, callback);
	},
	getFactionColor:
	function (str){
		return getFactionColor(str);
	},
	getFaction:
	function (integer){
		return getFaction(integer);
	},
	isAlphanumeric:
	function (str){
		return isAlphanumeric(str);
	},
	isNumeric:
	function (str){
		return isNumeric(str);
	},
	formattedDate:
	function (date){
		return formattedDate(date);
	},
	getTrackerFile:
	function (guild){
		return (getTrackerFile(guild));
	},
	getSpecifics:
	function (guild){
		return (getSpecifics(guild));
	},
	writeSpecifics:
	function (guild, specifics){
		return (writeSpecifics(guild, specifics));
	},
	emptyPromise:
	function (){
		return emptyPromise();
	},
	getCurrentLogPath:
	function (){
		return getCurrentLogPath();
	},
    checkToken:
    function (privatePath, tokenPath) {
        return checkToken(privatePath, tokenPath);
    },
    stripTags:
    function (str){
        return stripTags(str);
    }
}