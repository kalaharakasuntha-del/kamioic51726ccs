const { cmd } = require('../command');
const baileys = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const fs = require('fs');

/**
 * Send Group Status (with optional media + auto expire)
 */
async function groupStatus(client, jid, content) {
  try {
    const { backgroundColor } = content;
    delete content.backgroundColor;

    const inside = await baileys.generateWAMessageContent(content, {
      upload: client.waUploadToServer,
      backgroundColor
    });

    const messageSecret = crypto.randomBytes(32);

    const m = baileys.generateWAMessageFromContent(
      jid,
      {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: {
          message: {
            ...inside,
            messageContextInfo: { messageSecret }
          }
        }
      },
      {}
    );

    await client.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;

  } catch (err) {
    console.error("❌ GroupStatus Error:", err);
  }
}

cmd({
  pattern: "groupstatus",
  alias: ["gstatus", "gsx"],
  desc: "Send a text or media status visible to all group members.",
  category: "group",
  use: ".groupstatus <text> or reply with image/video + caption",
  react: "🟢",
  filename: __filename
},
async (conn, mek, m, { from, reply, q, mime, isOwner, isMedia }) => {

  try {
    // ❗ Group check
    if (!m.isGroup) return reply("⚠️ This command only works in groups!");

    // ✅ FIXED OWNER CHECK
    if (!isOwner) return reply("🚫 *Owner Only Command!*");

    let content = {};

    // 📸 Media handling
    if ((isMedia && /image|video/.test(mime)) || m.quoted?.mimetype) {

      const quoted = m.quoted ? m.quoted : m;
      const buffer = await quoted.download();
      const type = quoted.mimetype.split("/")[0];

      if (type === "image") {
        content = {
          image: buffer,
          caption: q || "📸 Group status updated",
        };
      } else if (type === "video") {
        content = {
          video: buffer,
          caption: q || "🎬 Group video status updated",
        };
      }

    } else {
      // 📝 Text status
      if (!q) return reply("📜 Use: .groupstatus <text>");

      content = {
        text: q,
        backgroundColor: "#25D366",
      };
    }

    // 🚀 Send status
    const statusMsg = await groupStatus(conn, from, content);

    if (!statusMsg) return reply("❌ Failed to send group status.");

    await reply("✅ Group status posted successfully! (expires in 24h)");

    // 🕒 Auto delete after 24h
    setTimeout(async () => {
      try {
        await conn.sendMessage(from, { delete: statusMsg.key });
        console.log(`🕒 Auto-deleted group status in ${from}`);
      } catch (e) {
        console.error("⚠️ Auto-delete failed:", e);
      }
    }, 24 * 60 * 60 * 1000);

  } catch (err) {
    console.error(err);
    reply("❌ Failed to send group status.");
  }
});
