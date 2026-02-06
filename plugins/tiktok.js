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

    // ⏳ processing
    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    // ⬇️ download start
    await conn.sendMessage(from, { react: { text: '⬇️', key: m.key } });

    const response = await axios.get(
      `https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${q}`
    );

    const data = response.data;
    if (!data || !data.status) {
      return reply("⚠️ Failed to retrieve TikTok media.");
    }

    const dat = data.data;

    const caption = `
📺 Tiktok Downloader 📥

📑 *Title:* ${dat.title || "No title"}
⏱️ *Duration:* ${dat.duration || "N/A"}
👍 *Likes:* ${dat.view || "0"}
💬 *Comments:* ${dat.comment || "0"}
🔁 *Shares:* ${dat.share || "0"}
📥 *Downloads:* ${dat.download || "0"}

🔢 *Reply Below Number*

1️⃣ HD Quality
2️⃣ SD Quality
3️⃣ Audio (MP3)

> Powered by DARK-KNIGHT-XMD`;

    const sentMsg = await conn.sendMessage(from, {
      image: { url: dat.thumbnail },
      caption
    }, { quoted: m });

    const messageID = sentMsg.key.id;

    conn.ev.on("messages.upsert", async (msgData) => {
      const receivedMsg = msgData.messages[0];
      if (!receivedMsg?.message) return;

      const receivedText =
        receivedMsg.message.conversation ||
        receivedMsg.message.extendedTextMessage?.text;

      const senderID = receivedMsg.key.remoteJid;
      const isReplyToBot =
        receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

      if (!isReplyToBot) return;

      const react = async (emoji) => {
        await conn.sendMessage(senderID, {
          react: { text: emoji, key: receivedMsg.key }
        });
      };

      switch (receivedText.trim()) {
        case "1":
          await react("⬇️"); // download
          await react("⬆️"); // upload
          await conn.sendMessage(senderID, {
            video: { url: dat.video },
            caption: "📥 Downloaded HD Quality"
          }, { quoted: receivedMsg });
          await react("✔️"); // done
          break;

        case "2":
          await react("⬇️");
          await react("⬆️");
          const sdUrl = dat.sd_video || dat.video;
          await conn.sendMessage(senderID, {
            video: { url: sdUrl },
            caption: "📥 Downloaded SD Quality"
          }, { quoted: receivedMsg });
          await react("✔️");
          break;

        case "3":
          await react("⬇️");
          await react("⬆️");
          await conn.sendMessage(senderID, {
            audio: { url: dat.audio },
            mimetype: "audio/mp3",
            ptt: false
          }, { quoted: receivedMsg });
          await react("✔️");
          break;

        default:
          reply("❌ Reply with 1, 2 or 3 only.");
      }
    });

  } catch (err) {
    console.error("TikTok Plugin Error:", err);
    reply("❌ Error occurred. Try again later.");
  }
});
