const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

              

cmd({
    pattern: "video1",
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❓ What video do you want to download?");

        const search = await yts(q);
        if (!search.videos.length) return reply("❌ No results found for your query.");

        const data = search.videos[0];
        const ytUrl = data.url;

        // Define API links for multiple qualities
        const formats = {
            "240p": `https://api.zenzxz.my.id/api/downloader/ytmp4v2?url=${encodeURIComponent(ytUrl)}&resolution=240`,
            "360p": `https://api.zenzxz.my.id/api/downloader/ytmp4v2?url=${encodeURIComponent(ytUrl)}&resolution=360`,
            "480p": `https://api.zenzxz.my.id/api/downloader/ytmp4v2?url=${encodeURIComponent(ytUrl)}&resolution=480`,
            "720p": `https://api.zenzxz.my.id/api/downloader/ytmp4v2?url=${encodeURIComponent(ytUrl)}&resolution=720`
        };

        // Prepare caption
        const caption = `
🎥 *Video Downloader.* 📥

📑 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📆 *Uploaded:* ${data.ago}
📊 *Views:* ${data.views}
🔗 *Link:* ${data.url}

🔢 *Reply Below Number*

🎥 *Video Types*
🔹 1.1 240p (Video)
🔹 1.2 360p (Video)
🔹 1.3 480p (Video)
🔹 1.4 720p (Video)

📁 *Document Types:*
🔹 2.1 240p (Document)
🔹 2.2 360p (Document)
🔹 2.3 480p (Document)
🔹 2.4 720p (Document)

> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳
        `;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption
        }, { quoted: m });

        const messageID = sentMsg.key.id;

        // Listen for user replies
        conn.ev.on("messages.upsert", async (msgData) => {
            const receivedMsg = msgData.messages[0];
            if (!receivedMsg?.message) return;

            const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToBot) {
                await conn.sendMessage(senderID, { react: { text: '⏳', key: receivedMsg.key } });

                let selectedFormat, isDocument = false;

                switch (receivedText.trim().toUpperCase()) {
                    case "1.1": selectedFormat = "240p"; break;
                    case "1.2": selectedFormat = "360p"; break;
                    case "1.3": selectedFormat = "480p"; break;
                    case "1.4": selectedFormat = "720p"; break;

                    case "2.1": selectedFormat = "240p"; isDocument = true; break;
                    case "2.2": selectedFormat = "360p"; isDocument = true; break;
                    case "2.3": selectedFormat = "480p"; isDocument = true; break;
                    case "2.4": selectedFormat = "720p"; isDocument = true; break;

                    default:
                        return reply("❌ Invalid option! Please reply with 1.1-1.4 or 2.1-2.4.");
                }

                const { data: apiRes } = await axios.get(formats[selectedFormat]);

                if (!apiRes?.success || !apiRes.data?.download_url) {
                    return reply(`❌ Unable to download the ${selectedFormat} version. Try another one!`);
                }

                const result = apiRes.data;

                if (isDocument) {
                    await conn.sendMessage(senderID, {
                        document: { url: result.download_url },
                        mimetype: "video/mp4",
                        fileName: `${data.title}.mp4`
                    }, { quoted: receivedMsg });
                } else {
                    await conn.sendMessage(senderID, {
                        video: { url: result.download_url },
                        mimetype: "video/mp4",
                        ptt:false,
                    }, { quoted: receivedMsg });
                }
            }
        });

    } catch (error) {
        console.error("Video Command Error:", error);
        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});
