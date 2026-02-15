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

cmd({
  pattern: "gid",
  alias: ["groupid", "grouplinkinfo"],
  react: "🖼️",
  desc: "Get Group info + profile picture from invite link",
  category: "whatsapp",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

  try {

    if (!q) {
      return reply("*Provide a WhatsApp Group link.*\n\nExample:\n.gid https://chat.whatsapp.com/xxxxxxxx");
    }

    // Extract invite code
    const match = q.match(/chat\.whatsapp\.com\/([\w-]+)/);
    if (!match) {
      return reply("⚠️ Invalid group link format.");
    }

    const inviteCode = match[1];

    // Fetch invite metadata
    let metadata;
    try {
      metadata = await conn.groupGetInviteInfo(inviteCode);
    } catch {
      return reply("❌ Link invalid or expired.");
    }

    if (!metadata?.id) {
      return reply("❌ Group not found.");
    }

    const text = `*— 乂 Group Link Info —*\n\n` +
      `🆔 *Group ID:* ${metadata.id}\n` +
      `📛 *Name:* ${metadata.subject}\n` +
      `📝 *Description:* ${metadata.desc || "No description"}\n` +
      `👥 *Members:* ${metadata.size || "Unknown"}\n` +
      `📅 *Created:* ${metadata.creation ? new Date(metadata.creation * 1000).toLocaleString() : "Unknown"}\n\n` +
      `> © Powerd by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

    // Try get group profile picture
    let groupPP = null;

    try {
      groupPP = await conn.profilePictureUrl(metadata.id, "image");
    } catch {
      groupPP = null;
    }

    // If profile picture exists send image
    if (groupPP) {
      await conn.sendMessage(from, {
        image: { url: groupPP },
        caption: text
      }, { quoted: fakevCard });
    } else {
      await reply(text);
    }

  } catch (err) {
    console.error("GID Error:", err);
    reply("❌ Error fetching group info.");
  }

});
