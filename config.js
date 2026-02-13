const fs = require("fs");
if (fs.existsSync("config.env"))
  require("dotenv").config({ path: "./config.env" });

function convertToBool(text, fault = "true") {
  return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID || "ranu&pJURTSxb#NSUeYqh7figatXcfz5SdHIqTXPAl1lrREC0xxiIXxuc",
// add your Session Id (මුලට "ranu&")
AUTO_RECORDING: process.env.AUTO_RECORDING || "false",
// make it true for auto recoding 
AUTO_TYPING: process.env.AUTO_TYPING || "false",
// true for automatic show typing    
ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "true",
// maks true for always online 
PREFIX: process.env.PREFIX || ".",
// add your prifix for bot
MODE: process.env.MODE || "public",
// make bot public-private-inbox-group
PUBLIC_MODE: process.env.PUBLIC_MODE || "true",
// make false if want private mod
AUTO_VOICE: process.env.AUTO_VOICE || "true",
// make true for send automatic voices
AUTO_STICKER: process.env.AUTO_STICKER || "true",
// make true for automatic stickers 
AUTO_REPLY: process.env.AUTO_REPLY || "true",
// make true or false automatic text reply 
AUTO_REACT: process.env.AUTO_REACT || "false",
// make this true or false for auto react on all msgs
AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN || "true",
// make true or false status auto seen
AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || "false",
// make true if you want auto reply on status 
AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT || "true",
// make true or false automatic status react
ANTI_DELETE: process.env.ANTI_DELETE || "true",
// make antidelete true or false
CUSTOM_REACT: process.env.CUSTOM_REACT || "false",
// make this true for custum emoji react
ANTI_VV: process.env.ANTI_VV || "true",
// true for anti once view 
WELCOME: process.env.WELCOME || "false",
// true if want welcome and goodbye msg in groups    
ADMIN_EVENTS: process.env.ADMIN_EVENTS || "false",
// make true to know who dismiss or promoted a member in group
ANTI_LINK: process.env.ANTI_LINK || "false",
// make anti link true,false for groups 
MENTION_REPLY: process.env.MENTION_REPLY || "false",
// make true if want auto voice reply if someone menetion you 
DELETE_LINKS: process.env.DELETE_LINKS || "false",
// automatic delete links witho remove member 
READ_MESSAGE: process.env.READ_MESSAGE || "false",
// Turn true or false for automatic read msgs
ANTI_BAD: process.env.ANTI_BAD || "false",
// false or true for anti bad words  
ANTI_LINK_KICK: process.env.ANTI_LINK_KICK || "false",
// make anti link true,false for groups 
READ_CMD: process.env.READ_CMD || "false",
// true if want mark commands as read
OWNER_NUM: process.env.OWNER_NUM || "94762095304",
// add owner number 
OWNER_NUMBER: process.env.OWNER_NUMBER || "94762095304", 
// add your bot owner number
DEV: process.env.DEV || "94762095304",
//replace with your whatsapp number
OWNER_NAME: process.env.OWNER_NAME || "HIRUKA RANUMITHA",
// add bot owner name
CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || "💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍",
// chose custom react emojis by yourself 
AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*SEEN YOUR STATUS BY RANUMITHA-X-MD 🌛*",
// set the auto reply massage on status reply  
BOT_NAME: process.env.BOT_NAME || "RANUMITHA-X-MD",
// add bot namw here for menu
STICKER_NAME: process.env.STICKER_NAME || "RANUMITHA-X-MD",
// type sticker pack name 
DESCRIPTION: process.env.DESCRIPTION || "© Powerd by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛",
// add bot owner name    
ALIVE_IMG: process.env.ALIVE_IMG || "https://raw.githubusercontent.com/Ranumithaofc/RANU-FILE-S-/refs/heads/main/images/GridArt_20250726_193256660.jpg",
// add img for alive msg
MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || "https://files.catbox.moe/ebcvj0.jpg",
// add custom menu and mention reply image url
LIVE_MSG: process.env.LIVE_MSG || "> 𝐌𝐚𝐝𝐞 𝐛𝐲 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔 🥶",
// add alive msg here 
ANTI_DEL_PATH: process.env.ANTI_DEL_PATH || "log", 
// change it to 'same' if you want to resend deleted message in same chat 
BOT_VERSION: process.env.BOT_VERSION || "3.5.8"

};
