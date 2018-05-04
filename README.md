
# Dostya
>_Vodka in the trunk_

## What is Dostya ?
Dostya is a Discord utility bot written in Javascript using the Discord.JS library. It is named after a character from the Supreme Commander series.

The purpose of the bot is to provide easy access to basic FAForever services through commands. It is intended to work on the FAForever official discord, but can work anywere else aswell.

## Commands
|       Usage         |Effect                         |
|----------------|-------------------------------|
|`alive/respond`| Test command to check if the bot is running |
|`help`| PMs a link to this page to the user|
|`unit <unitID>`|Returns an embed preview of the unit and link to the unitDB page          |
|`wiki <searchTerms>`|Performs a search on the faforever wiki and returns the first result     |
|`pool/ladderpool/ladder`          |Returns the current map pool for the 1v1 ladder|
|`replay <replayID>`|Returns a short résumé and a link to the replay given|
|`lastreplay <fafPlayerName>`|Returns the `!replay` of the last game played by the given user |
|`clan <fafClanTag/fafClanName>`|Returns information about the clan given     |
|`searchplayer <searchTerms>`| Returns a list of users whose username corresponds to the search term. Supports wildcard.   |
|`player/ratings <fafPlayerName>`| Returns an embed preview of the player's avatar and information about the player |
|`sendtracker/tracker`| PMs the tracker file to the user |

## Setting up the bot
The bot runs using NodeJS. If you do not have it installed already, fire the following command :
- `apt-get install nodejs`

### Downloading the bot files and the dependancies
- `git clone https://github.com/FAForever/Dostya.git`
- `cd Dostya`
- `npm update`
- `npm install --save`

### Setting up basic parameters
You need to give the bot a `token` for it to work properly. The token must be put in the `_private`folder of the bot, in the following way :
- `mkdir _private`
- `cd _private`
- `nano token.json`

Input the following :
```
{
  "token": "mySecretToken"
} 
```
### Setting up advanced parameters
Inside the `configuration/` folder you can find a `settings.json` that you can modify for additional functionnality.
```
{
  "debug-mode": false/true | Increases the amount of messages in the console, 
  "dev-only-mode": false/true | Only "dev" can fire commands, the bot ignore others,
  "dev-only-commands": ["command1", "command2", ...] | Only the "dev" can fire these commands,
  "devs": [MyDiscordId, OtherDiscordId, ...] | All those users will be considered as "dev",
  "prefixes": ["!", "Dostya! "] | Answer to the following prefixes,
  "write-logs": false/true | Write every console output to disk or not,
  "aliases": { | Automatically replace the following prefixes with the according command
	"#": "!replay "
  },
  "cooldown":30,	| Cooldown between each command
  "player-search-limit":5,	| Maximum number of results for a player search
  "urls":{	| Used by the online data fetching functions
	"unitDB":"http://direct.faforever.com/faf/unitsDB/",
	"wiki":"https://wiki.faforever.com/",
	"api":"https://api.faforever.com/data/"
  }
}
```
### Run the bot
Fire `node init_bot.js` and you should be good to go.