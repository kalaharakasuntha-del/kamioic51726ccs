const { cmd } = require('../command');
const axios = require('axios');

// Fake ChatGPT vCard
const fakevCard = {
    key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
    },
    message: {
        contactMessage: {
            displayName: "© Mr Hiruka (GPT-5) ✅",
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=18002428478:+18002428478
END:VCARD`
        }
    }
};

cmd({
    pattern: "gpt",
    alias: ["chatgpt", "openai", "ai2"],
    desc: "Chat with GPT AI",
    category: "ai",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, react }) => {
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
• .gpt \`Hello\`
• Reply to a message and type \`.gpt\``
                },
                { quoted: m }
            );
        }

        const apiUrl = `https://malvin-api.vercel.app/ai/gpt-5?text=${encodeURIComponent(userText)}`;

        await react("⏳");

        const { data } = await axios.get(apiUrl);

        if (!data || !data.result) {
            await react("❌");
            return reply("AI failed to respond.");
        }

        const responseMsg = `
🤖 *GPT-5 AI Response*  
━━━━━━━━━━━━━━━
${data.result}

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`.trim();

        // ✅ Send reply with fake vCard
        await conn.sendMessage(
            from,
            { text: responseMsg },
            { quoted: fakevCard }
        );

        await react("✅");

    } catch (e) {
        console.log(e);
        await react("❌");
        reply("Error communicating with AI.");
    }
});
