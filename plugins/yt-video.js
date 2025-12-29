const axios = require('axios');
const yts = require('yt-search');
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
    pattern: "video",
    alias: "ytvideo",
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        // 1️⃣ Determine the query (text or replied message)
        let query = q?.trim();

        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }

        if (!query) {
            return reply("⚠️ Please provide a video name or YouTube link (or reply to a message).");
        }

        // 2️⃣ Convert Shorts link to normal link
        if (query.includes("youtube.com/shorts/")) {
            const videoId = query.split("/shorts/")[1].split(/[?&]/)[0];
            query = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // 3️⃣ YouTube search
        const search = await yts(query);
        if (!search.videos.length) return reply("*❌ No results found.*");

        const data = search.videos[0];
        const ytUrl = data.url;

        // 4️⃣ Define API links for download
        const formats = {
            "240p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=240`,
            "360p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=360`,
            "480p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=480`,
            "720p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=720`
        };

        // 5️⃣ Send selection menu (image + caption)
        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 \`Title:\`* ${data.title}
*⏱️ \`Duration:\`* ${data.timestamp}
*📆 \`Uploaded:\`* ${data.ago}
*📊 \`Views:\`* ${data.views}
*🔗 \`Link:\`* ${data.url}

🔢 *Reply Below Number*

1. *Video FILE 📽️*
   1.1 240p Qulity 📽️
   1.2 360p Qulity 📽️
   1.3 480p Qulity 📽️
   1.4 720p Qulity 📽️

2. *Document FILE 📂*
   2.1 240p Qulity 📂
   2.2 360p Qulity 📂
   2.3 480p Qulity 📂
   2.4 720p Qulity 📂

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        // Send thumbnail + caption
const sentMsg = await conn.sendMessage(from, {
    image: { url: data.thumbnail },
    caption
}, { quoted: fakevCard });

const messageID = sentMsg.key.id;

// ================= LISTENER =================
conn.ev.on("messages.upsert", async ({ messages }) => {
    try {
        const receivedMsg = messages[0];
        if (!receivedMsg?.message) return;

        const receivedText =
            receivedMsg.message.conversation ||
            receivedMsg.message.extendedTextMessage?.text;

        if (!receivedText) return;

        const senderID = receivedMsg.key.remoteJid;

        const isReplyToBot =
            receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

        if (!isReplyToBot) return;

        let selectedFormat;
        let isDocument = false;

        switch (receivedText.trim()) {
            case "1.1": selectedFormat = "240p"; break;
            case "1.2": selectedFormat = "360p"; break;
            case "1.3": selectedFormat = "480p"; break;
            case "1.4": selectedFormat = "720p"; break;

            case "2.1": selectedFormat = "240p"; isDocument = true; break;
            case "2.2": selectedFormat = "360p"; isDocument = true; break;
            case "2.3": selectedFormat = "480p"; isDocument = true; break;
            case "2.4": selectedFormat = "720p"; isDocument = true; break;

            default:
                return conn.sendMessage(
                    senderID,
                    { text: "❌ Invalid option!\nReply with 1.1 – 1.4 or 2.1 – 2.4" },
                    { quoted: receivedMsg }
                );
        }

        // ⬇️ Download start
        await conn.sendMessage(senderID, {
            react: { text: "⬇️", key: receivedMsg.key }
        });

        const { data: apiRes } = await axios.get(formats[selectedFormat]);

        if (!apiRes?.success || !apiRes.result?.downloadUrl) {
            await conn.sendMessage(senderID, {
                react: { text: "❌", key: receivedMsg.key }
            });
            return;
        }

        const result = apiRes.result;

        // ⬆️ Upload start
        await conn.sendMessage(senderID, {
            react: { text: "⬆️", key: receivedMsg.key }
        });

        if (isDocument) {
            await conn.sendMessage(senderID, {
                document: { url: result.downloadUrl },
                mimetype: "video/mp4",
                fileName: `${result.title}.mp4`
            }, { quoted: receivedMsg });
        } else {
            await conn.sendMessage(senderID, {
                video: { url: result.downloadUrl },
                mimetype: "video/mp4",
                ptt: false
            }, { quoted: receivedMsg });
        }

        // ✅ Done
        await conn.sendMessage(senderID, {
            react: { text: "✔️", key: receivedMsg.key }
        });

    } catch (err) {
        console.error("Reply Handler Error:", err);
    }
});
