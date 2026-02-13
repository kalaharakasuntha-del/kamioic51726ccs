const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "gpt",
    desc: "Chat with GPT AI",
    category: "ai",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, react }) => {
    try {

        if (!q) {
            return reply("🧠 Please provide a message.\nExample: `.gpt Hello`");
        }

        const apiUrl = `https://malvin-api.vercel.app/ai/gpt-5?text=${encodeURIComponent(q)}`;

        const { data } = await axios.get(apiUrl);

        if (!data || !data.result) {
            await react("❌");
            return reply("AI failed to respond.");
        }

        const responseMsg = `
🤖 *AI Response*  
━━━━━━━━━━━━━━━  
${data.result}
        `.trim();

        await conn.sendMessage(from, { text: responseMsg });

        await react("✅");

    } catch (e) {
        console.log(e);
        await react("❌");
        reply("Error communicating with AI.");
    }
});
