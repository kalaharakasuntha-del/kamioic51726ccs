const { cmd } = require('../command');
const axios = require('axios');

// Fake VCard
        const fakevCard = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
      },
      message: {
        contactMessage: {
          displayName: "© Mr Hiruka",
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD`
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
        if (!q) return; // 🔕 no message

        const apiUrl = `https://malvin-api.vercel.app/ai/copilot?text=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data?.status || !data?.result) return; // 🔕 silent fail

        const responseMsg = `
🤖 *Microsoft Copilot AI Response*
━━━━━━━━━━━━━━━
${data.result}

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛
`.trim();

        await conn.sendMessage(
            from,
            { text: responseMsg },
            { quoted: fakevCard }
        );

        await react("✅");

    } catch (e) {
        // 🔕 totally silent (no reply, no react)
        console.log("Copilot error ignored");
    }
});
