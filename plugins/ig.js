const axios = require("axios");
const { cmd } = require('../command');

// Fake ChatGPT vCard
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
  pattern: "ig",
  alias: ["insta","instagram"],
  desc: "Download Instagram videos and audio",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, quoted, q, reply }) => {
  try {
    if (!q || !q.startsWith("https://")) {
      return conn.sendMessage(from, { text: "*❌ Please provide a valid Instagram URL*" }, { quoted: m });
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(q)}`;
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (!data || !data.status || !data.data || data.data.length === 0) {
      return reply("⚠️ Failed to retrieve Instagram media. Please check the link and try again.");
    }

    const media = data.data[0];
    const caption = `
📽️ *RANUMITHA-X-MD INSTAGRAM DOWNLOADER* 📽️

📑 *File type:* ${media.type.toUpperCase()}
🔗 *Link:* ${q}

💬 *Reply with your choice:*

 1️⃣ Video Type 🎥
 2️⃣ Audio only 🎶

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

    const sentMsg = await conn.sendMessage(from, {
      image: { url: media.thumbnail },
      caption
    }, { quoted: fakevCard });

    const messageID = sentMsg.key.id;

    // 🧠 Listen for user reply
    conn.ev.on("messages.upsert", async (msgData) => {
      const receivedMsg = msgData.messages[0];
      if (!receivedMsg?.message) return;

      const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
      const senderID = receivedMsg.key.remoteJid;
      const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

      if (isReplyToBot) {
        await conn.sendMessage(senderID, { react: { text: '⏳', key: receivedMsg.key } });

        switch (receivedText.trim()) {
          case "1":
            if (media.type === "video") {
              await conn.sendMessage(senderID, {
                video: { url: media.url },
                caption: "✅ Your video is ready"
              }, { quoted: receivedMsg });
            } else {
              reply("*⚠️ No video found*");
            }
            break;

          case "2":
              await conn.sendMessage(senderID, {
                audio: { url: media.url },
                mimetype: "audio/mp4",
                ptt: false
              }, { quoted: receivedMsg });
            break;

          default:
            reply("*❌ Invalid option!*");
        }
      }
    });

  } catch (error) {
    console.error("Instagram Plugin Error:", error);
    reply("*Error* Please try again later..");
  }
});
