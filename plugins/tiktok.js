const axios = require("axios");
const { cmd } = require('../command');

cmd({
  pattern: "tiktok",
  alias: ["tt"],
  desc: "Download TikTok videos",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, quoted, q, reply }) => {
  try {
    if (!q || !q.startsWith("https://")) {
      return conn.sendMessage(from, { text: "❌ Please provide a valid TikTok URL." }, { quoted: m });
    }

    // ආරම්භක reaction
    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // ⬇️ බාගත කිරීම ආරම්භ වූ විට
    await conn.sendMessage(from, { react: { text: '⬇️', key: m.key } });

    // ✅ Using NexOracle TikTok API
    const response = await axios.get(`https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${q}`);
    const data = response.data;

    if (!data || !data.status) {
      return reply("⚠️ Failed to retrieve TikTok media. Please check the link and try again.");
    }
    
    const dat = data.data;
    
    const caption = `
📺 Tiktok Downloader. 📥

📑 *Title:* ${dat.title || "No title"}
⏱️ *Duration:* ${dat.duration || "N/A"}
👍 *Likes:* ${dat.view || "0"}
💬 *Comments:* ${dat.comment || "0"}
🔁 *Shares:* ${dat.share || "0"}
📥 *Downloads:* ${dat.download || "0"}

🔢 *Reply Below Number*

1️⃣  *HD Quality* 🔋
2️⃣  *SD Quality* 📱
3️⃣  *Audio (MP3)* 🎶

> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`;

    const sentMsg = await conn.sendMessage(from, {
      image: { url: dat.thumbnail },
      caption
    }, { quoted: m });

    const messageID = sentMsg.key.id;

    // තොරතුරු ලැබුණු reaction
    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    // 🧠 Handle reply selector
    conn.ev.on("messages.upsert", async (msgData) => {
      const receivedMsg = msgData.messages[0];
      if (!receivedMsg?.message) return;

      const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
      const senderID = receivedMsg.key.remoteJid;
      const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

      if (isReplyToBot) {
        // 🚫 REMOVED: පිළිතුරක් ලැබුණු reaction (🔄 අයින් කරලා)

        switch (receivedText.trim()) {
          case "1":
            // ⬆️ HD Quality උඩුගත කිරීම ආරම්භ වූ විට
            await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });
            
            // HD Quality
            await conn.sendMessage(senderID, {
              video: { url: dat.video },
              caption: "📥 *Downloaded HD Quality*"
            }, { quoted: receivedMsg });
            
            // ✔️ සාර්ථකව යැවූ විට
            await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });
            break;

          case "2":
            // ⬆️ SD Quality උඩුගත කිරීම ආරම්භ වූ විට
            await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });
            
            // SD Quality
            try {
              const sdUrl = dat.sd_video || dat.video || dat.video_url;
              await conn.sendMessage(senderID, {
                video: { url: sdUrl },
                caption: "📥 *Downloaded SD Quality*"
              }, { quoted: receivedMsg });
            } catch (sdError) {
              await conn.sendMessage(senderID, {
                video: { url: dat.video },
                caption: "📥 *Downloaded Available Quality (HD)*"
              }, { quoted: receivedMsg });
            }
            
            // ✔️ සාර්ථකව යැවූ විට
            await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });
            break;

          case "3":
            // ⬆️ Audio උඩුගත කිරීම ආරම්භ වූ විට
            await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });
            
            // Audio MP3
            await conn.sendMessage(senderID, {
              audio: { url: dat.audio },
              mimetype: "audio/mp3",
              ptt: false
            }, { quoted: receivedMsg });
            
            // ✔️ සාර්ථකව යැවූ විට
            await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });
            break;

          default:
            // ❌ වැරදි තේරීමක් සඳහා
            await conn.sendMessage(senderID, { react: { text: '❌', key: receivedMsg.key } });
            reply("❌ Invalid option! Please reply with 1, 2 or 3.");
        }
      }
    });

  } catch (error) {
    console.error("TikTok Plugin Error:", error);
    // ❌ දෝෂයක් සිදුවු විට
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    reply("❌ An error occurred while processing your request. Please try again later.");
  }
});
