const { cmd } = require('../command');
const axios = require('axios');

// ✅ Fake ChatGPT vCard
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
FN:Meta AI
ORG:Meta;
TEL;type=CELL;type=VOICE;waid=94762095304:+94762095304
END:VCARD`
        }
    }
};

cmd({
    pattern: "gpt",
    desc: "Chat with Microsoft Copilot - GPT-5",
    category: "ai",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) {
            return reply("🧠 Please provide a message for the AI.\nExample: `.gpt Hello`");
        }

        await react("⏳");

        // ✅ Malvin API - GPT-5 Endpoint
        const apiUrl = `https://malvin-api.vercel.app/ai/gpt-5?text=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data?.status || !data?.result) {
            await react("❌");
            return reply("AI failed to respond. Please try again later.");
        }

        const responseMsg = `
🤖 *Microsoft Copilot GPT-5 AI Response*  
━━━━━━━━━━━━━━━  
${data.result}

🕒 *Response Time:* ${data.response_time || "Unknown"}
        `.trim();

        // ✅ Send with Fake vCard quoted
        await conn.sendMessage(from, {
            text: responseMsg
        }, {
            quoted: fakevCard
        });

        await react("✅");

    } catch (e) {
        console.error("Error in AI command:", e);
        await react("❌");
        reply("An error occurred while communicating with the AI.");
    }
});
