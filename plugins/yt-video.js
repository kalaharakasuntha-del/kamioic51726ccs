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

        // 4️⃣ Create selection menu caption
        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 Title:* ${data.title}
*⏱️ Duration:* ${data.timestamp}
*📆 Uploaded:* ${data.ago}
*📊 Views:* ${data.views}
*🔗 Link:* ${data.url}

*🔢 Reply Below Number*

1. *Video FILE 📽️*
   1.1 240p Quality 📽️
   1.2 360p Quality 📽️
   1.3 480p Quality 📽️
   1.4 720p Quality 📽️
   1.5 1080p Quality 📽️

2. *Document FILE 📂*
   2.1 240p Quality 📂
   2.2 360p Quality 📂
   2.3 480p Quality 📂
   2.4 720p Quality 📂
   2.5 1080p Quality 📂

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        // Send selection menu
        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption
        }, { quoted: fakevCard });

        // Create a listener for user response
        const listener = async (msg) => {
            try {
                const receivedMsg = msg.messages[0];
                if (!receivedMsg?.message || receivedMsg.key.remoteJid !== from) return;

                const receivedText = receivedMsg.message.conversation || 
                                   receivedMsg.message.extendedTextMessage?.text;
                
                if (!receivedText) return;

                let selectedFormat, isDocument = false;
                
                // Check which option was selected
                switch (receivedText.trim()) {
                    case "1.1": selectedFormat = "240p"; break;
                    case "1.2": selectedFormat = "360p"; break;
                    case "1.3": selectedFormat = "480p"; break;
                    case "1.4": selectedFormat = "720p"; break;
                    case "1.5": selectedFormat = "1080p"; break;
                    case "2.1": selectedFormat = "240p"; isDocument = true; break;
                    case "2.2": selectedFormat = "360p"; isDocument = true; break;
                    case "2.3": selectedFormat = "480p"; isDocument = true; break;
                    case "2.4": selectedFormat = "720p"; isDocument = true; break;
                    case "2.5": selectedFormat = "1080p"; isDocument = true; break;
                    default: return;
                }

                // Remove listener after receiving response
                conn.ev.off('messages.upsert', listener);

                // React with downloading emoji
                await conn.sendMessage(from, { 
                    react: { text: '⬇️', key: receivedMsg.key } 
                });

                // Use omnisave API
                const apiUrl = `https://ominisave.vercel.app/api/ytmp4?url=${encodeURIComponent(ytUrl)}`;
                
                const { data: apiRes } = await axios.get(apiUrl);
                
                if (!apiRes?.status || !apiRes.result?.url) {
                    await conn.sendMessage(from, { 
                        react: { text: '❌', key: receivedMsg.key } 
                    });
                    return reply("❌ Unable to download video. Please try again later.");
                }

                // Get video URL from API response
                const videoUrl = apiRes.result.url;
                const filename = apiRes.result.filename || `${data.title}.mp4`;

                // React with uploading emoji
                await conn.sendMessage(from, { 
                    react: { text: '⬆️', key: receivedMsg.key } 
                });

                // Send as document or video
                if (isDocument) {
                    await conn.sendMessage(from, {
                        document: { url: videoUrl },
                        mimetype: "video/mp4",
                        fileName: filename,
                        caption: `📥 *Downloaded Successfully!*\n📹 *Title:* ${data.title}\n📦 *Sent as:* Document`
                    }, { quoted: receivedMsg });
                } else {
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: `📥 *Downloaded Successfully!*\n📹 *Title:* ${data.title}`
                    }, { quoted: receivedMsg });
                }

                // React with success emoji
                await conn.sendMessage(from, { 
                    react: { text: '✅', key: receivedMsg.key } 
                });

            } catch (error) {
                console.error("Download error:", error);
                await conn.sendMessage(from, { 
                    react: { text: '❌', key: msg.messages[0].key } 
                });
                reply("❌ Error downloading video. Please try again.");
            }
        };

        // Add listener for user response
        conn.ev.on('messages.upsert', listener);

        // Set timeout to remove listener after 60 seconds
        setTimeout(() => {
            conn.ev.off('messages.upsert', listener);
        }, 60000);

    } catch (error) {
        console.error("Video Command Error:", error);
        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});
