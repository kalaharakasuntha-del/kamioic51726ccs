const { cmd } = require("../command");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// Fake vCard
const fakevCard = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast",
  },
  message: {
    contactMessage: {
      displayName: "© Mr Hiruka",
      vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=94762095304:+94762095304
END:VCARD`,
    },
  },
};

// Command
cmd(
  {
    pattern: "song5",
    alias: ["play5"],
    react: "🎵",
    desc: "Download YouTube song (Audio) via Nekolabs API",
    category: "download",
    use: ".song ",
    filename: __filename,
  },

  async (conn, mek, m, { from, reply, q }) => {
    try {
      // Get query
      let query = q?.trim();

      if (!query && m?.quoted) {
        query =
          m.quoted.message?.conversation ||
          m.quoted.message?.extendedTextMessage?.text ||
          m.quoted.text;
      }

      if (!query) {
        return reply(
          "⚠️ Please provide a song name or YouTube link (or reply to a message)."
        );
      }

      // Shorts → Normal link
      if (query.includes("youtube.com/shorts/")) {
        const videoId = query.split("/shorts/")[1].split(/[?&]/)[0];
        query = `https://www.youtube.com/watch?v=${videoId}`;
      }

      // API
      const apiUrl = `https://ominisave.vercel.app/api/ytmp3?url=${encodeURIComponent(
        ytUrl
      )}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (!data?.success || !data?.result?.downloadUrl) {
        return reply("❌ Song not found or API error.");
      }

      const meta = data.result.metadata;
      const dlUrl = data.result.downloadUrl;

      // Thumbnail
      let buffer;
      try {
        const thumbRes = await fetch(meta.cover);
        buffer = Buffer.from(await thumbRes.arrayBuffer());
      } catch {
        buffer = null;
      }

      // Caption
      const caption = `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${meta.title}
📡 *Channel:* ${meta.channel}
⏱ *Duration:* ${meta.duration}
🌐 *Url:* ${meta.url}

🔽 *Reply with your choice:*

1. *Audio Type* 🎵  
2. *Document Type* 📁  
3. *Voice Note Type* 🎤  

> © Powerd by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

      const sentMsg = await conn.sendMessage(
        from,
        { image: buffer, caption },
        { quoted: fakevCard }
      );

      const messageID = sentMsg.key.id;

      // Reply Listener
      conn.ev.on("messages.upsert", async (msgUpdate) => {
        try {
          const mekInfo = msgUpdate.messages[0];
          if (!mekInfo?.message) return;

          const userText =
            mekInfo.message.conversation ||
            mekInfo.message.extendedTextMessage?.text;

          const isReply =
            mekInfo?.message?.extendedTextMessage?.contextInfo?.stanzaId ===
            messageID;

          if (!isReply) return;

          const choice = userText.trim();

          // React ⬇️
          await conn.sendMessage(from, {
            react: { text: "⬇️", key: mekInfo.key },
          });

          const safeTitle = meta.title
            .replace(/[\\/:*?"<>|]/g, "")
            .slice(0, 80);

          const audioFileName = `${safeTitle}.mp3`;
          const tempPath = path.join(__dirname, `../temp/${Date.now()}.mp3`);
          const voicePath = path.join(__dirname, `../temp/${Date.now()}.opus`);

          let type;

          // Option 1: Audio
          if (choice === "1") {
            type = {
              audio: { url: dlUrl },
              mimetype: "audio/mpeg",
              fileName: audioFileName,
            };

            // Option 2: Document
          } else if (choice === "2") {
            type = {
              document: { url: dlUrl },
              mimetype: "audio/mpeg",
              fileName: audioFileName,
              caption: meta.title,
            };

            // Option 3: Voice Note
          } else if (choice === "3") {
            const audioRes = await fetch(dlUrl);
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
            fs.writeFileSync(tempPath, audioBuffer);

            await new Promise((resolve, reject) => {
              ffmpeg(tempPath)
                .audioCodec("libopus")
                .format("opus")
                .audioBitrate("64k")
                .save(voicePath)
                .on("end", resolve)
                .on("error", reject);
            });

            const voiceBuffer = fs.readFileSync(voicePath);

            type = {
              audio: voiceBuffer,
              mimetype: "audio/ogg; codecs=opus",
              ptt: true,
            };

            fs.unlinkSync(tempPath);
            fs.unlinkSync(voicePath);
          } else {
            return reply("❌ *Invalid choice!*");
          }

          // React ⬆️
          await conn.sendMessage(from, {
            react: { text: "⬆️", key: mekInfo.key },
          });

          // Send output file
          await conn.sendMessage(from, type, { quoted: mek });

          // React ✔️
          await conn.sendMessage(from, {
            react: { text: "✔️", key: mekInfo.key },
          });
        } catch (err) {
          console.error("reply handler error:", err);
        }
      });
    } catch (err) {
      console.error("song cmd error:", err);
      reply("⚠️ An error occurred while processing your request.");
    }
  }
);
