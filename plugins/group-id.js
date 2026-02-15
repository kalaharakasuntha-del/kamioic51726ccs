const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');

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
  alias: ["groupid"],
  react: "🔎",
  desc: "Get Group info from invite link",
  category: "whatsapp",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {

  try {

    if (!q) {
      return reply("Provide group link.\nExample:\n.gid https://chat.whatsapp.com/xxxx");
    }

    const match = q.match(/chat\.whatsapp\.com\/([\w-]+)/);
    if (!match) return reply("Invalid group link.");

    const inviteCode = match[1];

    // ✅ Only use invite info (SAFE)
    const inviteInfo = await conn.groupGetInviteInfo(inviteCode);

    if (!inviteInfo?.id) return reply("Group not found.");

    const text = `*「 Group Link Info 」*\n
🔥 Name: ${inviteInfo.subject}
🆔 ID: ${inviteInfo.id}
👥 Members: ${inviteInfo.size}
👑 Owner: ${inviteInfo.owner || "Unknown"}
📃 Description: ${inviteInfo.desc || "No description"}
📅 Created: ${inviteInfo.creation ? new Date(inviteInfo.creation * 1000).toLocaleString() : "Unknown"}

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

    // 🔥 Use preview image from invite metadata
    let imageBuffer;

    try {
        if (inviteInfo.preview) {
            const imgUrl = `https://pps.whatsapp.net${inviteInfo.preview}`;
            imageBuffer = await getBuffer(imgUrl);
        } else {
            throw "No preview";
        }
    } catch {
        imageBuffer = await getBuffer("https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png");
    }

    await conn.sendMessage(from, {
        image: imageBuffer,
        caption: text
    }, { quoted: fakevCard });

  } catch (err) {
    console.log(err);
    reply("❌ Failed to fetch group info. Link invalid or expired.");
  }

});
