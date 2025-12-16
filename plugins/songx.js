const { cmd } = require('../command');
const fetch = require('node-fetch');
const yts = require('yt-search');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

cmd({
    pattern: "songx",
    react: "🎵",
    desc: "Download YouTube MP3 / Voice Note",
    category: "download",
    use: ".song <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        // Get query from text or quoted message
        let query = q?.trim();
        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }
        if (!query) return reply("⚠️ Please provide a song name or YouTube link (or reply to a message).");

        // Convert Shorts link to normal YouTube link
        if (query.includes("youtube.com/shorts/")) {
            const videoId = query.split("/shorts/")[1].split(/[?&]/)[0];
            query = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // Search YouTube
        const search = await yts(query);
        if (!search.videos.length) return reply("❌ No results found for your query.");
        const data = search.videos[0];

        // Fetch download link
        const api = `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(data.url)}`;
        const { data: apiRes } = await axios.get(api);
        if (!apiRes?.status || !apiRes.data?.url) return reply("❌ Unable to download the song!");
        const result = apiRes.data;

        // Send selection message
        const caption = `
🎵 *Song Downloader* 📥

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
            image: { url: data.thumbnail },
            caption
        }, { quoted: m });

        // Track users who already replied
        const repliedUsers = new Set();

        // Temporary listener for this message
        const listener = async (msgData) => {
            const receivedMsg = msgData.messages[0];
            const receivedText = receivedMsg.message?.conversation || receivedMsg.message?.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;

            if (!isReplyToBot || !receivedText) return;

            // Ignore if user already replied
            if (repliedUsers.has(senderID)) return;
            repliedUsers.add(senderID);

            // React ⬇️ download started
            await conn.sendMessage(senderID, { react: { text: '⬇️', key: receivedMsg.key } });

            switch (receivedText.trim()) {
                case "1": // Audio
                    await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });
                    await conn.sendMessage(senderID, {
                        audio: { url: result.url },
                        mimetype: "audio/mpeg",
                        ptt: false
                    }, { quoted: receivedMsg });
                    await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });
                    break;

                case "2": // Document
                    await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });
                    await conn.sendMessage(senderID, {
                        document: { url: result.url, mimetype: "audio/mpeg", fileName: `${data.title}.mp3` }
                    }, { quoted: receivedMsg });
                    await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });
                    break;

                case "3": // Voice Note (Opus)
                    const tempInput = path.join(__dirname, `temp_${Date.now()}.mp3`);
                    const tempOutput = path.join(__dirname, `temp_${Date.now()}.opus`);

                    // Download MP3
                    const writer = fs.createWriteStream(tempInput);
                    const response = await axios.get(result.url, { responseType: 'stream' });
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    await conn.sendMessage(senderID, { react: { text: '⬆️', key: receivedMsg.key } });

                    // Convert to Opus
                    await new Promise((resolve, reject) => {
                        ffmpeg(tempInput)
                            .outputOptions(['-c:a libopus', '-b:a 64k', '-vbr on'])
                            .save(tempOutput)
                            .on('end', resolve)
                            .on('error', reject);
                    });

                    // Send PTT
                    await conn.sendMessage(senderID, {
                        audio: { url: tempOutput },
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true
                    }, { quoted: receivedMsg });

                    await conn.sendMessage(senderID, { react: { text: '✔️', key: receivedMsg.key } });

                    // Clean up
                    fs.unlinkSync(tempInput);
                    fs.unlinkSync(tempOutput);
                    break;

                default:
                    reply("❌ Invalid option! Please reply with 1, 2, or 3.");
            }
        };

        // Add listener for this command
        conn.ev.on("messages.upsert", listener);

    } catch (err) {
        console.error(err);
        reply("❌ An error occurred. Please try again later.");
    }
});
