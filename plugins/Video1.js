const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
    pattern: "song2",
    react: "🎵",
    desc: "Download YouTube MP3",
    category: "download",
    use: ".song <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❓ What song do you want to download?");

        const search = await yts(q);
        if (!search.videos.length) return reply("❌ No results found for your query.");

        const data = search.videos[0];
        const ytUrl = data.url;

        // NekoLabs API
        const api = `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=mp3`;
        const { data: apiRes } = await axios.get(api);

        if (!apiRes?.success || !apiRes.result?.downloadUrl) {
            return reply("❌ Unable to download the song. Please try another one!");
        }

        const result = apiRes.result;

        const caption = `
🎵 *Song Downloader.* 📥

📑 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📆 *Uploaded:* ${data.ago}
📊 *Views:* ${data.views}
🔗 *Link:* ${data.url}

🔢 *Reply Below Number*

1️⃣ *Audio Type*
2️⃣ *Document Type*
3️⃣ *Voice Note*
 
> Powered by 𝙳𝙰𝚁𝙺-𝙺𝙽𝙸𝙶𝙷𝚃-𝚇𝙼𝙳`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: result.cover },
            caption
        }, { quoted: m });

        const messageID = sentMsg.key.id;

        conn.ev.on("messages.upsert", async (msgData) => {
            const receivedMsg = msgData.messages[0];
            if (!receivedMsg?.message) return;

            const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToBot) {
                await conn.sendMessage(senderID, { react: { text: '⏳', key: receivedMsg.key } });

                switch (receivedText.trim()) {
                    case "1":
                        await conn.sendMessage(senderID, {
                            audio: { url: result.downloadUrl },
                            mimetype: "audio/mpeg",
                            ptt: false,
                        }, { quoted: receivedMsg });
                        break;

                    case "2":
                        await conn.sendMessage(senderID, {
                            document: { url: result.downloadUrl },
                            mimetype: "audio/mpeg",
                            fileName: `${result.title}.mp3`
                        }, { quoted: receivedMsg });
                        break;

                    case "3":
                        await conn.sendMessage(senderID, {
                            audio: { url: result.downloadUrl },
                            mimetype: "audio/mpeg",
                            ptt: true,
                        }, { quoted: receivedMsg });
                        break;

                    default:
                        reply("❌ Invalid option! Please reply with 1, 2, or 3.");
                }
            }
        });

    } catch (error) {
        console.error("Song Command Error:", error);
        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});


cmd({
    pattern: "video2",
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❓ *Please provide a video name or link!*");

        const yts = (await import("yt-search")).default;
        const axios = (await import("axios")).default;

        const search = await yts(q);
        if (!search.videos.length) return reply("❌ No results found for your query.");

        const data = search.videos[0];
        const ytUrl = data.url;

        const formats = {
            "240p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=240`,
            "360p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=360`,
            "480p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=480`,
            "720p": `https://api.nekolabs.my.id/downloader/youtube/v1?url=${encodeURIComponent(ytUrl)}&format=720`
        };

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

📁 *Document Types*
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

                if (!apiRes?.success || !apiRes.result?.downloadUrl) {
                    return reply(`❌ Unable to download the ${selectedFormat} version. Try another one!`);
                }

                const result = apiRes.result;

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
