const { cmd } = require("../command");

cmd({
  pattern: "rch",
  react: "🤖",
  desc: "Owner Only: Multi emoji reply to channel/group post",
  category: "owner",
  use: ".rch <post_link> <emoji1>|<emoji2>|<emoji3>",
  filename: __filename
},
async (conn, mek, m, { from, isOwner }) => {

  const reply = (text) =>
    conn.sendMessage(from, { text }, { quoted: m });

  if (!isOwner) return reply("🚫 *Owner Only Command!*");

  // ❗ must reply to a post/message
  const quoted = m.quoted;
  if (!quoted) {
    return reply(
`❌ *Reply to the channel post first!*
Then use:
.rch https://whatsapp.com/channel/xxxx/123 😊|💙|💚`
    );
  }

  // get text
  const text =
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    "";

  const args = text.trim().split(/\s+/).slice(1);

  if (args.length < 2) {
    return reply(
`❌ Usage:
.rch https://whatsapp.com/channel/xxxx/123 😊|💙|💚`
    );
  }

  // first arg = link (ONLY for display)
  const postLink = args[0];

  // rest = emojis
  const emojis = args
    .slice(1)
    .join(" ")
    .split("|")
    .map(e => e.trim())
    .filter(Boolean);

  if (!emojis.length) return reply("❌ Emojis not found!");

  let success = 0;
  let failed = 0;

  // loading react
  await conn.sendMessage(from, {
    react: { text: "⏳", key: quoted.key }
  });

  // send emoji replies to quoted post
  for (const emoji of emojis) {
    try {
      await conn.sendMessage(
        quoted.key.remoteJid,
        { text: emoji },
        { quoted }
      );
      success++;
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.error(e);
      failed++;
    }
  }

  return reply(
`🤖 *MULTI EMOJI REPLY DONE*
━━━━━━━━━━━━━━
🔗 Link: ${postLink}
😀 Emojis: ${emojis.join(" ")}
✅ Success: ${success}
❌ Failed: ${failed}`
  );
});
