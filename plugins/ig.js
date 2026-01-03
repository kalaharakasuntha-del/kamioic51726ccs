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


// 🔐 Global session store
global.activeIGMenus = global.activeIGMenus || new Map();

/* ================= IG COMMAND ================= */

cmd({
  pattern: "ig",
  alias: ["insta", "instagram"],
  desc: "Instagram Downloader (Full Fixed)",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
  try {
    if (!q || !q.startsWith("https://")) {
      return reply("❌ Please provide a valid Instagram URL");
    }

    // ⏳ Fetching
    await conn.sendMessage(from, {
      react: { text: "📽️", key: m.key }
    });

    let data;
    try {
      const res = await axios.get(
        `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(q)}`,
        { timeout: 15000 }
      );
      data = res.data;
    } catch {
      const res = await axios.get(
        `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(q)}`,
        { timeout: 15000 }
      );
      data = res.data;
    }

    if (!data?.status || !data.data?.length) {
      return reply("*⚠️ Failed to retrieve Instagram file*");
    }

    const media = data.data[0];

    // 📽️ Ready
    await conn.sendMessage(from, {
      react: { text: "📽️", key: m.key }
    });

    const menuMsg = await conn.sendMessage(from, {
      image: { url: media.thumbnail },
      caption: `
📽️ *RANUMITHA-X-MD INSTAGRAM DOWNLOADER* 📽️

📑 *File type:* ${media.type.toUpperCase()}
🔗 *Link:* ${q}

💬 *Reply with your choice:*

 1️⃣ Video Type 🎥
 2️⃣ Audio only 🎶

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`
    }, { quoted: fakevCard });

    // 🔐 Save session
    global.activeIGMenus.set(menuMsg.key.id, {
      media,
      from
    });

    // 🧹 Auto clear after 10 min
    setTimeout(() => {
      global.activeIGMenus.delete(menuMsg.key.id);
    }, 10 * 60 * 1000);

  } catch (err) {
    console.error("IG CMD ERROR:", err);
    reply("*Error*");
  }
});

/* ================= ONE GLOBAL LISTENER ================= */

cmd({
  on: "body"
}, async (conn, m) => {
  try {
    if (!m.message?.extendedTextMessage) return;

    const text = m.message.extendedTextMessage.text?.trim();
    const ctx = m.message.extendedTextMessage.contextInfo;
    if (!ctx?.stanzaId) return;

    const session = global.activeIGMenus.get(ctx.stanzaId);
    if (!session) return;

    const { media, from } = session;

    // ❌ INVALID OPTION CHECK
    if (text !== "1" && text !== "2") {
      return conn.sendMessage(from, {
        text: "*❌ Invalid option!*"
      }, { quoted: m });
    }

    // ⬇️ Downloading
    await conn.sendMessage(from, {
      react: { text: "⬇️", key: m.key }
    });

    await new Promise(r => setTimeout(r, 600));

    // ⬆️ Uploading
    await conn.sendMessage(from, {
      react: { text: "⬆️", key: m.key }
    });

    if (text === "1") {
      if (media.type !== "video") {
        return conn.sendMessage(from, {
          text: "*⚠️ Video not found*"
        }, { quoted: m });
      }

      await conn.sendMessage(from, {
        video: { url: media.url },
        caption: "✅ Your video is ready"
      }, { quoted: m });

    } else if (text === "2") {

      await conn.sendMessage(from, {
        audio: { url: media.url },
        mimetype: "audio/mp4"
      }, { quoted: m });
    }

    // ✔️ Sent
    await conn.sendMessage(from, {
      react: { text: "✔️", key: m.key }
    });

  } catch (e) {
    console.error("*Error*:", e);
  }
});
