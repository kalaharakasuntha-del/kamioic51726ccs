const { cmd } = require("../command");

cmd({
  pattern: "getvideonote",
  alias: ["gvn"],
  desc: "Convert replied video to WhatsApp Video Note",
  category: "owner",
  react: "🎥",
  use: ".gvn <reply to video>",
  filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
  try {
    // Check reply
    if (!m.quoted) {
      return reply("⚠️ *Please reply to a video!*");
    }

    // Check message type
    if (m.quoted.mtype !== "videoMessage") {
      return reply("⚠️ *Reply only to a video message!*");
    }

    // Reaction: downloading
    await conn.sendMessage(from, {
      react: { text: "⬇️", key: mek.key }
    });

    // Download video
    const videoBuffer = await m.quoted.download();

    // Reaction: uploading
    await conn.sendMessage(from, {
      react: { text: "⬆️", key: mek.key }
    });

    // Send as Video Note (PTV)
    await conn.sendMessage(from, {
      video: videoBuffer,
      mimetype: "video/mp4",
      ptv: true
    }, { quoted: mek });

    // Done reaction
    await conn.sendMessage(from, {
      react: { text: "✔️", key: mek.key }
    });

  } catch (err) {
    console.error(err);
    reply("*Error while creating video note!*");
  }
});
