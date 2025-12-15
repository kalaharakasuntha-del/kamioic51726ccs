const config = require('../config');
const { cmd } = require('../command');
const { runtime } = require('../lib/functions');
const os = require("os");

// Store alive wait list
global.lastAliveMessage = {};


// Fake vCard
const fakevCard = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "© Mr Hiruka",
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=94762095304:+94762095304
END:VCARD`
        }
    }
};



cmd({
    pattern: "alive2",
    alias: ["hyranu2", "ranu2", "status2", "a2"],
    react: "🌝",
    desc: "Check bot online.",
    category: "main",
    filename: __filename
},
async (robin, mek, m, { from, pushname, quoted, reply, sender }) => {

    try {
        await robin.sendPresenceUpdate('recording', from);

        // Send Voice Note
        await robin.sendMessage(from, {
            audio: {
                url: "https://github.com/Ranumithaofc/RANU-FILE-S-/raw/refs/heads/main/Audio/Ranumitha-x-md-Alive-org.opus"
            },
            mimetype: 'audio/mp4',
            ptt: true
        }, { quoted: fakevCard });


        const caption = `
👋 Hello ${pushname}, I am alive now !!

╭─〔 💠 ALIVE STATUS 💠 〕─◉
│🐼 *Bot*: 𝐑𝐀𝐍𝐔𝐌𝐈𝐓𝐇𝐀-𝐗-𝐌𝐃
│🤵‍♂ *Owner*: ᴴᴵᴿᵁᴷᴬ ᴿᴬᴺᵁᴹᴵᵀᴴᴬ
│⏰ *Uptime*: ${runtime(process.uptime())}
│⏳ *RAM*: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB 
│🖊 *Prefix*: ${config.PREFIX}
│🛠 *Mode*: ${config.MODE}
│🖥 *Host*: ${os.hostname()}
│🌀 *Version*: ${config.BOT_VERSION}
╰─────────────────────────────⊷
     
      *1. Bot Speed 🔥*
      *2. Bot Menu 📂*

> Made by RANUMITHA 🥶
`;

        // Send Alive Image + Caption
        await robin.sendMessage(from, {
            image: {
                url: "https://raw.githubusercontent.com/Ranumithaofc/RANU-FILE-S-/refs/heads/main/images/GridArt_20250726_193256660.jpg"
            },
            caption: caption,
            contextInfo: {
                mentionedJid: [sender]
            }
        }, { quoted: mek });


        // Enable reply handler for this user
        global.lastAliveMessage[sender] = { chat: from, quotedKey: mek.key };


    } catch (e) {
        console.log("Alive2 Error:", e);
        reply(`⚠️ Error: ${e.message}`);
    }
});



// =======================
//   OPTION REPLY HANDLER
// =======================

cmd({
    on: "text"
},
async (robin, mek, m, { from, sender }) => {

    try {
        const msg = mek.message?.conversation ||
                    mek.message?.extendedTextMessage?.text ||
                    "";

        // Only process if this user triggered alive2
        if (!global.lastAliveMessage[sender]) return;

        // Accept only 1 or 2
        if (!/^(1|2)$/.test(msg.trim())) return;

        // React
        await robin.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

        // ------- Option Handling -------
        let replyMsg = "";

        if (msg.trim() === "1") {
            replyMsg = `🔥 *BOT SPEED CHECK* 🔥

Pong! Bot is active 💨`;
        }

        if (msg.trim() === "2") {
            replyMsg = `📂 *BOT MENU* 📂

Menu is loading...`;
        }

        // Send TEXT ONLY reply (no image)
        await robin.sendMessage(from, { text: replyMsg }, { quoted: mek });

        // Remove user from alive-wait list
        delete global.lastAliveMessage[sender];

    } catch (err) {
        console.log("Alive2 Option Handler Error:", err);
    }

});
