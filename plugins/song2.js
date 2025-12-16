const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// Fake ChatGPT vCard
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

cmd({
  pattern: "song2",
  alias: ["play2"],
  react: "🎵",
  desc: "YouTube Song Downloader (Multi Reply + Voice Note Fixed)",
  category: "download",
  use: ".song2 <query>",
  filename: __filename,
}, async (conn, mek, m, { from, reply, q }) => {
  try {
    // ===== QUERY =====
    let query = q?.trim();
    if (!query && m?.quoted) {
      query =
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text ||
        m.quoted.text;
    }

    if (!query)
      return reply("⚠️ Please provide a song name or YouTube link (or reply to a message).");

    if (query.includes("youtube.com/shorts/")) {
      const id = query.split("/shorts/")[1].split(/[?&]/)[0];
      query = `https://www.youtube.com/watch?v=${id}`;
    }

    // ===== SEARCH =====
    const search = await yts(query);
    if (!search.videos.length) return reply("❌ Song not found or API error.");
    const video = search.videos[0];

    // ===== API =====
    const api = `https://api.nekolabs.my.id/downloader/youtube/play/v1?q=${encodeURIComponent(video.url)}`;
    const { data } = await axios.get(api);
    if (!data?.status || !data?.data?.url) return reply("*❌ Download error*");

    const songUrl = data.data.url;

    // ===== MENU =====
    const sent = await conn.sendMessage(
      from,
      {
        image: { url: video.thumbnail },
        caption: `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${video.title}
⏱ *Duration:* ${video.timestamp}
📆 *Uploaded:* ${video.ago}
👁 *Views:* ${video.views}
🔗 *Url:* ${video.url}

🔽 *Reply with your choice:*

1. *Audio Type* 🎵  
2. *Document Type* 📁  
3. *Voice Note Type* 🎤  

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝐃 🌛`,
      },
      { quoted: fakevCard }
    );

    const menuId = sent.key.id;

    // ===== REACT HELPER =====
    const react = async (emoji, key) => {
      await conn.sendMessage(from, { react: { text: emoji, key } });
    };

    // ===== MULTI REPLY LISTENER =====
    const handler = async (up) => {
      const msg = up.messages?.[0];
      if (!msg?.message) return;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
      const stanzaId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;

      // Only reply to this menu
      if (stanzaId !== menuId) return;
      if (!["1", "2", "3"].includes(text)) return;

      await react("⬇️", msg.key);

      // ===== OPTION 1 : AUDIO =====
      if (text === "1") {
        await react("⬆️", msg.key);
        await conn.sendMessage(from, { audio: { url: songUrl }, mimetype: "audio/mpeg" }, { quoted: msg });
        return react("✔️", msg.key);
      }

      // ===== OPTION 2 : DOCUMENT =====
      if (text === "2") {
        const buffer = await axios.get(songUrl, { responseType: "arraybuffer" });
        await react("⬆️", msg.key);
        await conn.sendMessage(from, { document: buffer.data, mimetype: "audio/mpeg", fileName: `${video.title}.mp3` }, { quoted: msg });
        return react("✔️", msg.key);
      }

      // ===== OPTION 3 : VOICE NOTE =====
      if (text === "3") {
        const mp3Path = path.join(__dirname, `${Date.now()}.mp3`);
        const opusPath = path.join(__dirname, `${Date.now()}.opus`);

        // Download mp3
        const stream = await axios.get(songUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(mp3Path);
        stream.data.pipe(writer);
        await new Promise(r => writer.on("finish", r));

        // Convert to opus
        await new Promise((resolve, reject) => {
          ffmpeg(mp3Path)
            .audioCodec("libopus")
            .format("opus")
            .save(opusPath)
            .on("end", resolve)
            .on("error", reject);
        });

        await react("⬆️", msg.key);
        await conn.sendMessage(from, { audio: fs.readFileSync(opusPath), mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });

        fs.unlinkSync(mp3Path);
        fs.unlinkSync(opusPath);
        return react("✔️", msg.key);
      }
    };

    conn.ev.on("messages.upsert", handler);

  } catch (e) {
    console.error(e);
    reply("*Error occurred while processing your request*");
  }
});
