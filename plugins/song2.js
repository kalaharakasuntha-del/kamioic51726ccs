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

cmd(
  {
    pattern: "song3",
    react: "🎵",
    desc: "Download YouTube Song",
    category: "download",
    use: ".song3 <song name>",
    filename: __filename,
  },

  async (conn, mek, m, { from, reply, q }) => {
    try {
      if (!q) return reply("❓ Song name ekak hari YouTube link ekak hari denna.");

      // Search YouTube
      const search = await yts(q);
      if (!search.videos.length) return reply("❌ Song ekak hoyaganna bari una.");

      const video = search.videos[0];
      const ytUrl = video.url;

      // API
      const apiUrl = `https://gtech-api-xtp1.onrender.com/api/audio/yt?apikey=APIKEY&url=${encodeURIComponent(
        ytUrl
      )}`;

      const { data } = await axios.get(apiUrl);

      if (!data?.status || !data?.result?.media?.audio_url) {
        return reply("❌ Song download karanna bari una.");
      }

      const audioUrl = data.result.media.audio_url;
      const thumbnail = data.result.media.thumbnail;

      // Caption
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

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

      const sentMsg = await conn.sendMessage(
        from,
        { image: { url: thumbnail }, caption },
        { quoted: fakevCard }
      );

      const messageID = sentMsg.key.id;

      // Reply Listener
      conn.ev.on("messages.upsert", async (msgUpdate) => {
        try {
          const mekInfo = msgUpdate.messages[0];
          if (!mekInfo?.message) return;

          const text =
            mekInfo.message.conversation ||
            mekInfo.message.extendedTextMessage?.text;

          const isReply =
            mekInfo.message?.extendedTextMessage?.contextInfo?.stanzaId ===
            messageID;

          if (!isReply) return;

          const choice = text.trim();

          // ⬇️ Download react
          await conn.sendMessage(from, {
            react: { text: "⬇️", key: mekInfo.key },
          });

          const safeTitle = video.title
            .replace(/[\\/:*?"<>|]/g, "")
            .slice(0, 80);

          const tempMp3 = path.join(__dirname, `../temp/${Date.now()}.mp3`);
          const tempOpus = path.join(__dirname, `../temp/${Date.now()}.opus`);

          // ⬆️ Upload react
          await conn.sendMessage(from, {
            react: { text: "⬆️", key: mekInfo.key },
          });

          // 1️⃣ Audio
          if (choice === "1") {
            await conn.sendMessage(
              from,
              {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                fileName: `${safeTitle}.mp3`,
              },
              { quoted: mek }
            );

          // 2️⃣ Document
          } else if (choice === "2") {
            await conn.sendMessage(
              from,
              {
                document: { url: audioUrl },
                mimetype: "audio/mpeg",
                fileName: `${safeTitle}.mp3`,
              },
              { quoted: mek }
            );

          // 3️⃣ Voice Note
          } else if (choice === "3") {
            const audioRes = await axios.get(audioUrl, {
              responseType: "arraybuffer",
            });

            fs.writeFileSync(tempMp3, audioRes.data);

            await new Promise((resolve, reject) => {
              ffmpeg(tempMp3)
                .audioCodec("libopus")
                .format("opus")
                .audioBitrate("64k")
                .save(tempOpus)
                .on("end", resolve)
                .on("error", reject);
            });

            const voiceBuffer = fs.readFileSync(tempOpus);

            await conn.sendMessage(
              from,
              {
                audio: voiceBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              },
              { quoted: mek }
            );

            fs.unlinkSync(tempMp3);
            fs.unlinkSync(tempOpus);
          } else {
            return reply("*❌ Invalid choice!*");
          }

          // ✔️ Done react
          await conn.sendMessage(from, {
            react: { text: "✔️", key: mekInfo.key },
          });
        } catch (e) {
          console.error("reply handler error:", e);
        }
      });
    } catch (err) {
      console.error("song3 cmd error:", err);
      reply("⚠️ Song process karaddi error ekak una.");
    }
  }
);
