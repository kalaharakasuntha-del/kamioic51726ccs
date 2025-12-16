const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
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

// Temp folder
const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

cmd(
  {
    pattern: "song",
    alias: ["play", "song1", "play1"],
    react: "🎵",
    desc: "Download YouTube Song",
    category: "download",
    use: ".song <song name> OR reply + .song",
    filename: __filename,
  },

  async (conn, mek, m, { from, reply, q }) => {
    try {
      // 🔹 reply text support
      if (!q) {
        const quoted =
          mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          q = quoted.conversation || quoted.extendedTextMessage?.text;
        }
      }

      if (!q)
        return reply(
          "⚠️ Please provide a song name or YouTube link (or reply to a message)."
        );

      let video;

      // 🔹 Check if input is YouTube URL (including Shorts)
      const ytRegex =
        /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|shorts\/)?([a-zA-Z0-9_-]{11,})/;
      const match = q.match(ytRegex);

      if (match) {
        const videoId = match[5];
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const search = await yts(videoUrl);
        if (!search.videos?.length) return reply("❌ The song could not be found.");

        video = search.videos[0];
      } else {
        // Normal search
        const search = await yts(q);
        if (!search.videos?.length) return reply("❌ The song could not be found.");

        video = search.videos[0];
      }

      // 🌐 API call to download
      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(
        video.url
      )}`;
      const { data } = await axios.get(apiUrl);

      if (!data?.status || !data?.data?.url) return reply("❌ The song could not be found.");

      const audioUrl = data.data.url;

      // 📩 menu
      const caption = `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${video.title}
⏱ *Duration:* ${video.timestamp}
📆 *Uploaded:* ${video.ago}
👁 *Views:* ${video.views}
🔗 *Url:* ${video.url}

🔽 *Reply with your choice:*

1️⃣ *Audio Type* 🎵
2️⃣ *Document Type* 📁
3️⃣ *Voice Note Type* 🎤

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝐃 🌛`;

      const sentMsg = await conn.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption },
        { quoted: fakevCard }
      );

      const messageID = sentMsg.key.id;

      // 🧠 one-time reply handler
      const handler = async (msgUpdate) => {
        try {
          const mekInfo = msgUpdate.messages?.[0];
          if (!mekInfo?.message) return;

          const text =
            mekInfo.message.conversation ||
            mekInfo.message.extendedTextMessage?.text;

          const isReply =
            mekInfo.message?.extendedTextMessage?.contextInfo?.stanzaId === messageID;

          if (!isReply) return;

          const choice = text.trim();

          const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 80);

          const tempMp3 = path.join(tempDir, `${Date.now()}.mp3`);
          const tempOpus = path.join(tempDir, `${Date.now()}.opus`);

          // ⬇️ Download react
          await conn.sendMessage(from, { react: { text: "⬇️", key: mekInfo.key } });

          // ⬆️ Upload react
          await conn.sendMessage(from, { react: { text: "⬆️", key: mekInfo.key } });

          // 1️⃣ Audio
          if (choice === "1") {
            await conn.sendMessage(
              from,
              { audio: { url: audioUrl }, mimetype: "audio/mpeg", fileName: `${safeTitle}.mp3` },
              { quoted: mek }
            );

            // 2️⃣ Document
          } else if (choice === "2") {
            await conn.sendMessage(
              from,
              { document: { url: audioUrl }, mimetype: "audio/mpeg", fileName: `${safeTitle}.mp3` },
              { quoted: mek }
            );

            // 3️⃣ Voice note
          } else if (choice === "3") {
            const res = await axios.get(audioUrl, { responseType: "arraybuffer" });
            fs.writeFileSync(tempMp3, res.data);

            await new Promise((resolve, reject) => {
              ffmpeg(tempMp3)
                .audioCodec("libopus")
                .format("opus")
                .audioBitrate("64k")
                .save(tempOpus)
                .on("end", resolve)
                .on("error", reject);
            });

            const voice = fs.readFileSync(tempOpus);

            await conn.sendMessage(
              from,
              { audio: voice, mimetype: "audio/ogg; codecs=opus", ptt: true },
              { quoted: mek }
            );

            fs.unlinkSync(tempMp3);
            fs.unlinkSync(tempOpus);
          } else {
            await reply("*❌ Invalid choice!*");
          }

          // ✔️ Done react
          await conn.sendMessage(from, { react: { text: "✔️", key: mekInfo.key } });

          // remove listener
          conn.ev.off("messages.upsert", handler);
        } catch (e) {
          console.error("song reply error:", e);
        }
      };

      conn.ev.on("messages.upsert", handler);
    } catch (err) {
      console.error("song cmd error:", err);
      reply("*Error*");
    }
  }
);
