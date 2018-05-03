//EXPORTS AT EOF
const settings = require("../configuration/settings.json");
const trackfile = "./_private/tracker.txt";
const fs = require("fs");
const mkdirp = require("mkdirp");

////////////////
/// LOG FUNCTION
////////////////
function log(message, type="--", guild=undefined){
	const logGuildNameLength = 8;
	var guildName = "";
	let debug = false;
	let debugChat = false;
	for (var i = 0; i< logGuildNameLength; i++){
		guildName += " ";
	}
	if (guild != undefined){
		guildName = guild.name;
		const forbiddenChars = ["*", "/"];
		
		for (let i = 0; i<forbiddenChars.length; i++){
			while(guildName.indexOf(forbiddenChars[i]) > -1){
				guildName = guildName.replace(forbiddenChars[i], ".");
			}
		}
		//debug =	getSetting(guild, "debug-mode");
		//debugChat = getSetting(guild, "debug-chat-mode");
	}
	guildColor = uniqueNumber(guildName, 7);
	guildColorType = uniqueNumber(guildName, 2);
	guildColor = 30 + 60*guildColorType + guildColor;
	const consoleString = "\x1B[2m["+time()+"]\x1B[0m \x1B["+guildColor+"m["+makeLong(guildName,logGuildNameLength)+"]\x1B[0m \x1B[7m["+type+"]\x1B[27m "+message;
	if (debug || type != 'DD'){
		if (type != '++'){
			console.log(consoleString);
		}
		if (guild /*&& getSetting(guild, "write-logs")*/){
			let id = 0;
			if (guild != undefined && guild.id != undefined){
				id = guild.id+'-'+makeLong(guildName, 8);
			}
			const path = "./logs/"+id+"/";
			const fullPath = path+(guildName)+"."+time(true)+".log";
			
			if (!fs.existsSync(path)){
				mkdirp.sync(path);
			}
			if (!fs.existsSync(fullPath)){
				fs.writeFileSync(fullPath, "- QAIx Log Start -", {"encoding":'utf8'});
			}
			let logContent = fs.readFileSync(fullPath);			
			const logString = "["+time()+"] ["+makeLong(guildName,logGuildNameLength*2)+"] ["+type+"] "+message;
			fs.writeFileSync(fullPath, logContent+"\r\n"+logString, {"encoding":'utf8'});
		}
	}
	if (debugChat && consoleString){
		globalChatStamp[guild] += "["+type+"] "+message+"\r\n";
	}
}

function replyToId(str_reply_user){
	
	let thisUserId = str_reply_user.substring(2, str_reply_user.length-1);
	if (thisUserId.charAt(0) == "!"){
		thisUserId = thisUserId.substring(1, thisUserId.length);
	}
	return thisUserId;
}

function track(guildMember){
	if (!fs.existsSync(trackfile)){
		fs.writeFileSync(trackfile, time()+" - Dostya user tracking start\r\n", {"encoding":'utf8'});
	}
	let trackerContent = fs.readFileSync(trackfile);
	fs.writeFileSync(trackfile, trackerContent+"\r\n["+time()+"] "+guildMember.guild.name+" - "+guildMember.id+" - "+guildMember.user.username, {"encoding":'utf8'});
}


//Utils i'll comment later
function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
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

//EXPORTS FOR SHARED USE
module.exports = {
   log: 
	function(message, type="--", guild){
		if (true || type !="DD"){
			log(message, type, guild);
		}
	},
	
	replyToId:
	function (str){
		return replyToId(str);
	},
	
	track:
	function (gm){
		return track(gm);
	}
	
}