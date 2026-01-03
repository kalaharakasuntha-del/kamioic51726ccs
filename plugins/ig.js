const axios = require("axios");
const { cmd } = require('../command');

// Fake vCard
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
    pattern: "instagram",
    alias: ["insta"],
    react: "📥",
    desc: "Download Instagram Video / Audio",
    category: "download",
    use: ".instagram <url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q || !q.startsWith("http")) return reply("❌ Please provide a valid Instagram link");

        // ⏳ Processing react
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data?.status || !data.data?.length) return reply("❌ Failed to fetch Instagram media");

        const media = data.data[0];

        const caption = `
*📥 RANUMITHA-X-MD INSTAGRAM DOWNLOADER*

*🗂️ Type:* ${media.type.toUpperCase()}
*🔗 Link:* ${q}

🔢 *Reply Below Number*

1️⃣ *Video (HD)* 📽️
2️⃣ *Audio (MP3)* 🎶

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: media.thumbnail },
            caption
        }, { quoted: fakevCard });

        const messageID = sentMsg.key.id;

        // 🔁 Listen for reply (SAFE listener)
        const handler = async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.message) return;

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text;

            const isReply =
                msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (!isReply) return;

            // remove listener after use
            conn.ev.off("messages.upsert", handler);

            // ⬇️ Download react
            await conn.sendMessage(from, { react: { text: "⬇️", key: msg.key } });

            // ⬆️ Upload react
            await conn.sendMessage(from, { react: { text: "⬆️", key: msg.key } });

            switch (text.trim()) {
                case "1":
                    if (media.type !== "video") return reply("❌ This post has no video");
                    await conn.sendMessage(from, {
                        video: { url: media.url },
                        mimetype: "video/mp4"
                    }, { quoted: msg });
                    break;

                case "2":
                    await conn.sendMessage(from, {
                        audio: { url: media.url },
                        mimetype: "audio/mpeg",
                        ptt: false
                    }, { quoted: msg });
                    break;

                default:
                    return reply("❌ Invalid option");
            }

            // ✔️ Done react
            await conn.sendMessage(from, { react: { text: "✔️", key: msg.key } });
        };

        conn.ev.on("messages.upsert", handler);

    } catch (e) {
        console.log(e);
        reply("❌ Error occurred");
    }
});
