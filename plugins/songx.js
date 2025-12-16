const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

cmd({
  pattern: "song4",
  react: "🎵",
  desc: "YouTube Song Downloader (Multi Reply)",
  category: "download",
  use: ".song4 <query>",
  filename: __filename,
}, async (conn, mek, m, { from, reply, q }) => {
  try {
    /* ===== QUERY ===== */
    let query = q?.trim();
    if (!query && m?.quoted) {
      query =
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text;
    }
    if (!query) return reply("⚠️ Song name or YouTube link ekak denna");

    if (query.includes("youtube.com/shorts/")) {
      const id = query.split("/shorts/")[1].split(/[?&]/)[0];
      query = `https://www.youtube.com/watch?v=${id}`;
    }

    /* ===== SEARCH ===== */
    const search = await yts(query);
    if (!search.videos.length)
      return reply("❌ Song eka hambune naha");

    const video = search.videos[0];

    /* ===== API ===== */
    const api = `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(
      video.url
    )}`;
    const { data } = await axios.get(api);
    if (!data?.status || !data?.data?.url)
      return reply("❌ Download error");

    const songUrl = data.data.url;

    /* ===== MENU ===== */
    const sent = await conn.sendMessage(
      from,
      {
        image: { url: video.thumbnail },
        caption: `
🎵 *Song Downloader*

📌 *${video.title}*
⏱️ ${video.timestamp}

Reply with number 👇
(Multi reply supported)

1️⃣ Audio  
2️⃣ MP3 Document  
3️⃣ Voice Note
`,
      },
      { quoted: m }
    );

    const menuId = sent.key.id;

    /* ===== REACT ===== */
    const react = async (emoji, key) => {
      await conn.sendMessage(from, {
        react: { text: emoji, key },
      });
    };

    /* ===== LISTENER ===== */
    const handler = async (up) => {
      const msg = up.messages?.[0];
      if (!msg?.message) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text;

      const stanzaId =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId;

      if (stanzaId !== menuId) return;
      if (!["1", "2", "3"].includes(text)) return;

      await react("⬇️", msg.key);

      /* ===== AUDIO ===== */
      if (text === "1") {
        await react("⬆️", msg.key);

        await conn.sendMessage(from, {
          audio: { url: songUrl },
          mimetype: "audio/mpeg",
        }, { quoted: msg });

        return react("✔️", msg.key);
      }

      /* ===== DOCUMENT ===== */
      if (text === "2") {
        const buffer = await axios.get(songUrl, {
          responseType: "arraybuffer",
        });

        await react("⬆️", msg.key);

        await conn.sendMessage(from, {
          document: buffer.data,
          mimetype: "audio/mpeg",
          fileName: `${video.title}.mp3`,
        }, { quoted: msg });

        return react("✔️", msg.key);
      }

      /* ===== VOICE NOTE (FIXED) ===== */
      if (text === "3") {
        const mp3Path = path.join(__dirname, `${Date.now()}.mp3`);
        const opusPath = path.join(__dirname, `${Date.now()}.opus`);

        /* download mp3 */
        const stream = await axios.get(songUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(mp3Path);
        stream.data.pipe(writer);
        await new Promise(r => writer.on("finish", r));

        /* convert to opus */
        await new Promise((resolve, reject) => {
          ffmpeg(mp3Path)
            .audioCodec("libopus")
            .format("opus")
            .save(opusPath)
            .on("end", resolve)
            .on("error", reject);
        });

        await react("⬆️", msg.key);

        await conn.sendMessage(from, {
          audio: fs.readFileSync(opusPath),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
        }, { quoted: msg });

        fs.unlinkSync(mp3Path);
        fs.unlinkSync(opusPath);

        return react("✔️", msg.key);
      }
    };

    conn.ev.on("messages.upsert", handler);
  } catch (e) {
    console.error(e);
    reply("❌ Error occurred");
  }
});
