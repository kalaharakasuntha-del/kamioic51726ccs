const { cmd } = require('../command');
const axios = require('axios');

// Fake VCard
const FakeVCard = {
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
TEL;type=CELL;type=VOICE;waid=13135550002:+13135550002
END:VCARD`
    }
  }
};

cmd({
  pattern: "copilot",
  alias: ["ai1"],
  desc: "Chat with an AI model",
  category: "ai",
  react: "🤖",
  filename: __filename
},
async (conn, mek, m, { from, q, react }) => {
  try {

    // ✅ Get text from command OR replied message
    let userText = q?.trim();

    if (!userText && m?.quoted) {
      userText =
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text ||
        m.quoted.text;
    }

    // ❌ If no text provided
    if (!userText) {
      return conn.sendMessage(
        from,
        {
          text: `🧠 *Please provide a message for the AI.*

📌 Example:
• \`.copilot Hello\`
• Reply to a message and type \`.copilot\``
        },
        { quoted: m }
      );
    }

    const apiUrl = `https://malvin-api.vercel.app/ai/copilot?text=${encodeURIComponent(userText)}`;
    const { data } = await axios.get(apiUrl);

    if (!data?.status || !data?.result) return;

    const responseMsg = `
🤖 *Microsoft Copilot AI Response*
━━━━━━━━━━━━━━━
${data.result}

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛
`.trim();

    await conn.sendMessage(
      from,
      { text: responseMsg },
      { quoted: FakeVCard }
    );

    await react("✅");

  } catch (e) {
    console.log("Copilot error:", e.message);
  }
});
