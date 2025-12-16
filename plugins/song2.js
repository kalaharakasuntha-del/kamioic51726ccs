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
    pattern: "song2",
    alias: ["play2"],
    react: "🎵",
    desc: "Download YouTube Song",
    category: "download",
    use: ".song2 <song name> OR reply + .song2",
    filename: __filename,
  },

  async (conn, mek, m, { from, reply, q }) => {
    try {
      // 🔹 Get reply text if no query
      if (!q) {
        const quoted =
          mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          q =
            quoted.conversation ||
            quoted.extendedTextMessage?.text;
        }
      }

      if (!q)
        return reply(
          "⚠️ Please provide a song name or YouTube link (or reply to a message)."
        );

      // 🔍 Search YouTube
      const search = await yts(q);
      if (!search.videos?.length)
        return reply("❌ The song could not be found.");

      const video = search.videos[0];

      // 🌐 API
      const apiUrl = `https://gtech-api-xtp1.onrender.com/api/audio/yt?apikey=APIKEY&url=${encodeURIComponent(
        video.url
      )}`;

      const { data } = await axios.get(apiUrl);
      if (!data?.status || !data?.result?.media?.audio_url)
        return reply("❌ Song download karanna bari una.");

      const audioUrl = data.result.media.audio_url;
      const thumbnail = data.result.media.thumbnail;

      // 📩 Menu message
      const caption = `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${video.title}
⏱ *Duration:* ${video.timestamp}
📆 *Uploaded:* ${video.ago}
👁 *Views:* ${video.views}

🔽 *Reply with your choice:*

1️⃣ Audio 🎵
2️⃣ Document 📁
3️⃣ Voice Note 🎤

> © 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗`;

      const sentMsg = await conn.sendMessage(
        from,
        { image: { url: thumbnail }, caption },
        { quoted: fakevCard }
      );

      const msgId = sentMsg.key.id;

      // 🧠 Reply handler
      const handler = async (msgUpdate) => {
        const mekInfo = msgUpdate.messages?.[0];
        if (!mekInfo?.message) return;

        const text =
          mekInfo.message.conversation ||
          mekInfo.message.extendedTextMessage?.text;

        const isReply =
          mekInfo.message?.extendedTextMessage?.contextInfo?.stanzaId === msgId;

        if (!isReply) return;

        const choice = text.trim();
        const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 80);

        const tempMp3 = path.join(tempDir, `${Date.now()}.mp3`);
        const tempOpus = path.join(tempDir, `${Date.now()}.opus`);

        // ⬇️ Download react
        await conn.sendMessage(from, {
          react: { text: "⬇️", key: mekInfo.key },
        });

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

        // 3️⃣ Voice note
        } else if (choice === "3") {
          const audioRes = await axios.get(audioUrl, {
            responseType: "arraybuffer",
          });

          fs.writeFileSync(tempMp3, audioRes.data);

          await new Promise((res, rej) => {
            ffmpeg(tempMp3)
              .audioCodec("libopus")
              .format("opus")
              .audioBitrate("64k")
              .save(tempOpus)
              .on("end", res)
              .on("error", rej);
          });

          const voice = fs.readFileSync(tempOpus);

          await conn.sendMessage(
            from,
            {
              audio: voice,
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

        conn.ev.off("messages.upsert", handler);
      };

      conn.ev.on("messages.upsert", handler);
    } catch (e) {
      console.error(e);
      reply("*Error*");
    }
  }
);
