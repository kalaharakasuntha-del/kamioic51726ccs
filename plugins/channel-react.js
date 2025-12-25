const { cmd } = require("../command");

cmd({
  pattern: "creact",
  react: "📢",
  desc: "Channel react using link only (no reply)",
  category: "channel",
  use: ".creact <link>,💙",
  filename: __filename
}, async (conn, mek, m, { q, reply }) => {
  try {
    if (!q)
      return reply("❌ Use:\n.creact <channel_link>,💙");

    // split link and emojis
    const parts = q.split(",");
    if (parts.length < 2)
      return reply("❌ Link ekata passe emoji denna");

    const link = parts.shift().trim();
    const emojis = parts.map(e => e.trim()).filter(Boolean);

    // extract channelId & messageId
    const match = link.match(
      /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/([0-9]+)/
    );
    if (!match)
      return reply("❌ Invalid channel message link");

    const channelId = match[1];
    const messageId = match[2];
    const channelJid = `${channelId}@newsletter`;

    // build fake key (Baileys workaround)
    const key = {
      remoteJid: channelJid,
      id: messageId,
      fromMe: false
    };

    for (const emoji of emojis) {
      await conn.sendMessage(channelJid, {
        react: { text: emoji, key }
      });
      await new Promise(r => setTimeout(r, 700));
    }

    reply(`✅ Channel reacted: ${emojis.join(" ")}`);

  } catch (err) {
    console.error("Channel react error:", err);
    reply("❌ React failed (WhatsApp limitation)");
  }
});
