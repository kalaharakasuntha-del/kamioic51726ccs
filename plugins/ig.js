const axios = require("axios");
const { cmd } = require('../command');

// Fake vCard
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
  desc: "Instagram Downloader (Fixed)",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
  try {
    if (!q || !q.startsWith("https://")) {
      return reply("❌ Please provide a valid Instagram URL");
    }

    await conn.sendMessage(from, {
      react: { text: "📽️", key: m.key }
    });

    const res = await axios.get(
      `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(q)}`,
      { timeout: 15000 }
    );

    if (!res.data?.status || !res.data.data?.length) {
      return reply("⚠️ Failed to retrieve Instagram file");
    }

    const media = res.data.data[0];

    const menuMsg = await conn.sendMessage(from, {
      image: { url: media.thumbnail },
      caption: `
📽️ *RANUMITHA-X-MD INSTAGRAM DOWNLOADER* 📽️

📑 *File type:* ${media.type.toUpperCase()}

💬 *Reply with your choice:*
1️⃣ Video 🎥
2️⃣ Audio 🎶

> © Powered by RANUMITHA-X-MD 🌛`
    }, { quoted: fakevCard });

    global.activeIGMenus.set(menuMsg.key.id, {
      media,
      from
    });

    setTimeout(() => {
      global.activeIGMenus.delete(menuMsg.key.id);
    }, 10 * 60 * 1000);

  } catch (e) {
    console.error(e);
    reply("*Error occurred*");
  }
});

/* ================= ONE GLOBAL LISTENER ================= */

cmd({ on: "body" }, async (conn, m) => {
  try {
    // ✅ VERY IMPORTANT FIX
    if (m.key.fromMe) return; // ❌ ignore bot messages
    if (!m.message?.extendedTextMessage) return;

    const text = m.message.extendedTextMessage.text?.trim();
    const ctx = m.message.extendedTextMessage.contextInfo;
    if (!ctx?.stanzaId) return;

    const session = global.activeIGMenus.get(ctx.stanzaId);
    if (!session) return;

    const { media, from } = session;

    // ❌ Invalid option
    if (text !== "1" && text !== "2") {
      return conn.sendMessage(from, {
        text: "*❌ Invalid option!*\nReply with 1 or 2"
      }, { quoted: m });
    }

    await conn.sendMessage(from, {
      react: { text: "⬇️", key: m.key }
    });

    await new Promise(r => setTimeout(r, 500));

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

    await conn.sendMessage(from, {
      react: { text: "✔️", key: m.key }
    });

  } catch (err) {
    console.error("LISTENER ERROR:", err);
  }
});
