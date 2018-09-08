
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
|`map <mapID/mapName>`|Returns an embed preview of the map and a link to download it |
|`wiki <searchTerms>`|Performs a search on the faforever wiki and returns the first result     |
|`pool/ladderpool/ladder`          |Returns the current map pool for the 1v1 ladder|
|`replay <replayID>`|Returns a short résumé and a link to the replay given|
|`lastreplay <fafPlayerName>`|Returns the `!replay` of the last game played by the given user |
|`clan <fafClanTag/fafClanName>`|Returns information about the clan given     |
|`searchplayer <searchTerms>`| Returns a list of users whose username corresponds to the search term. Supports wildcard.   |
|`player/ratings <fafPlayerName>`| Returns an embed preview of the player's avatar and information about the player |
|`sendtracker/tracker`| PMs the tracker file to the user |
|`restrictions`| PMs the restricted commands list to the user |
|`link <fafPlayerName>`| Links the discord user account to the FAF player account given |
|`subscribe <roleName>`| Subscribe to a (discord) role that was registered via Dostya |
|`unsubscribe <roleName>`| Unsubscribe from a (discord) role that was registered via Dostya |

### Moderator commands
|       Usage         |Effect                         |
|----------------|-------------------------------|
|`blacklist <@user>`| Prevents a user to fire any command on this guild|
|`blacklist`| PMs the current blacklist of the bot|
|`unblacklist <@user>`| Removes an user from the blacklist|
|`restrict <command>`|Prevents anyone from firing the command, except Mods          |
|`unrestrict <command>`|Remove the command from the restrictions list|
|`fixbridge`|Reinitializes the connection to all IRC bridges established|
|`links/showlinks`|Display a list showing which user is linked to which faf account|
|`unlink <@user/fafId>`|Breaks the link between a discord user and a faf account|
|`loghere`|Registers the current channel for moderator actions logging|
|`testlog`|Outputs a test message in the moderator logging channel|
|`record <command> <message>`|Records a predefined message that will show up next time anyone fires the <command>|
|`record <command>`|Deletes the message associated with the <command>|
|`records/showrecords`|Lists the recorded messages|
|`ban <user/userID> *<message> *><duration>`|Bans the user with the corresponding <message> (if provided) and the given >duration (if provided) in hours. The user will be unbanned automatically when the time comes.|
|`kick <user/userID> *<message>`|Kicks the user with the corresponding <message> (if provided)|
|`warn <user/userID> *<message>`|Warns the user with the corresponding <message> (if provided) or with an automatic warning message|
|`userinfo <user/userID>`|Outputs in the moderator log channel the bans/kicks/warnings record of the given user.|
|`createrole <roleName>`|Create a role with roleName that is registered with Dostya and allows subscribing
|`deleterole <roleName>`|Delete a role that was created via Dostya. Will attempt to delte the discord role aswell.|

### Developer commands
|       Usage         |Effect                         |
|----------------|-------------------------------|
|`define/def <property> <datatype> <value>`| Defines a guild-specific setting for the bot|
|`logs`| PMs the last bot logs to the user|
|`kill`| Kills the bot process.|

## Setting up the bot
The bot runs using NodeJS. If you do not have it installed already, fire the following command :
- `apt-get install nodejs`

### Downloading the bot files and the dependancies
- `git clone https://github.com/FAForever/Dostya.git`
- `cd Dostya`
- `npm update`
- `npm install --save`

### Setting up basic parameters
You need to give the bot a `token` for it to work properly. The token must be put in the `_private` folder of the bot, in the following way :
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
Inside the `configuration/` folder you can find a `settings.json` that you can modify for additional functionnality. This file will be automatically created.

### Run the bot
Fire `npm start` and you should be good to go.

### Setting up moderators for a specific guild
- Add your Discord ID to the `devs` property inside the `configuration/settings.json` file
- Fire the bot
- In the guild of your choice, fire `!def mods array @ModeratorRoleA,@ModeratorRoleB,...` to add a number of moderator roles of your choice.
- The users with those roles will be able to fire moderator commands.