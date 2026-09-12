const axios = require("axios");
const yts = require("yt-search");
const { cmd } = require("../command");

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

// Get text from replied message
function getReplyText(m) {
    if (!m?.quoted) return "";

    return (
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text ||
        m.quoted.message?.imageMessage?.caption ||
        m.quoted.message?.videoMessage?.caption ||
        m.quoted.message?.documentMessage?.caption ||
        m.quoted.text ||
        ""
    ).trim();
}

// Main command
cmd({
    pattern: "video",
    alias: ["ytvideo", "."],
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {

    try {

        // ==========================================
        // 1. GET SEARCH QUERY
        // ==========================================

        let query = q?.trim();

        // If no text after command,
        // get text from replied message
        if (!query && m?.quoted) {
            query = getReplyText(m);
        }

        if (!query) {
            return reply(
                "⚠️ Please provide a video name or YouTube link.\n\n" +
                "Example:\n" +
                ".video Nilan Hettiarachchi\n\n" +
                "Or reply to a message with:\n" +
                "."
            );
        }

        // ==========================================
        // 2. CONVERT YOUTUBE SHORTS LINK
        // ==========================================

        if (query.includes("youtube.com/shorts/")) {

            const videoId =
                query.split("/shorts/")[1]?.split(/[?&]/)[0];

            if (!videoId) {
                return reply("❌ Invalid YouTube Shorts link.");
            }

            query =
                `https://www.youtube.com/watch?v=${videoId}`;
        }

        // ==========================================
        // 3. YOUTUBE SEARCH
        // ==========================================

        let search;

        try {
            search = await yts(query);
        } catch (searchError) {
            console.error("YouTube Search Error:", searchError);

            return reply(
                "❌ YouTube search failed.\nPlease try again."
            );
        }

        if (
            !search ||
            !search.videos ||
            !search.videos.length
        ) {
            return reply("*❌ No results found.*");
        }

        const data = search.videos[0];

        const ytUrl = data.url;

        // ==========================================
        // 4. API FORMATS
        // ==========================================

        const formats = {

            "144p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=144p&mode=separate`,

            "360p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=360p&mode=separate`,

            "480p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=480p&mode=separate`,

            "720p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=720p&mode=separate`,

            "1080p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=1080p&mode=separate`
        };

        // ==========================================
        // 5. MENU
        // ==========================================

        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 \`Title:\`* ${data.title}
*⏱️ \`Duration:\`* ${data.timestamp}
*📆 \`Uploaded:\`* ${data.ago}
*📊 \`Views:\`* ${data.views}
*🔗 \`Link:\`* ${data.url}

🔢 *Reply Below Number*

1. *Video FILE 📽️*
   1.1 144p Quality 📽️
   1.2 360p Quality 📽️
   1.3 480p Quality 📽️
   1.4 720p Quality 📽️
   1.5 1080p Quality 📽️

2. *Document FILE 📂*
   2.1 144p Quality 📂
   2.2 360p Quality 📂
   2.3 480p Quality 📂
   2.4 720p Quality 📂
   2.5 1080p Quality 📂

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        // ==========================================
        // 6. SEND MENU
        // ==========================================

        const sentMsg = await conn.sendMessage(
            from,
            {
                image: {
                    url: data.thumbnail
                },
                caption: caption
            },
            {
                quoted: fakevCard
            }
        );

        const messageID = sentMsg.key.id;

        // ==========================================
        // 7. LISTEN FOR REPLY
        // ==========================================

        conn.ev.on("messages.upsert", async (msgData) => {

            try {

                const receivedMsg =
                    msgData.messages?.[0];

                if (!receivedMsg?.message) return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text;

                if (!receivedText) return;

                const senderID =
                    receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage?.contextInfo;

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                // Only accept reply in same chat
                if (
                    !isReplyToBot ||
                    senderID !== from
                ) {
                    return;
                }

                // ==================================
                // 8. SELECT QUALITY
                // ==================================

                let selectedFormat;
                let isDocument = false;

                switch (
                    receivedText
                        .trim()
                        .toUpperCase()
                ) {

                    // VIDEO
                    case "1.1":
                        selectedFormat = "144p";
                        break;

                    case "1.2":
                        selectedFormat = "360p";
                        break;

                    case "1.3":
                        selectedFormat = "480p";
                        break;

                    case "1.4":
                        selectedFormat = "720p";
                        break;

                    case "1.5":
                        selectedFormat = "1080p";
                        break;

                    // DOCUMENT
                    case "2.1":
                        selectedFormat = "144p";
                        isDocument = true;
                        break;

                    case "2.2":
                        selectedFormat = "360p";
                        isDocument = true;
                        break;

                    case "2.3":
                        selectedFormat = "480p";
                        isDocument = true;
                        break;

                    case "2.4":
                        selectedFormat = "720p";
                        isDocument = true;
                        break;

                    case "2.5":
                        selectedFormat = "1080p";
                        isDocument = true;
                        break;

                    default:

                        return conn.sendMessage(
                            senderID,
                            {
                                text: "*❌ Invalid option!*\n\nReply with 1.1 - 2.5."
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                }

                // ==================================
                // 9. DOWNLOAD REACTION
                // ==================================

                await conn.sendMessage(
                    senderID,
                    {
                        react: {
                            text: "⬇️",
                            key: receivedMsg.key
                        }
                    }
                );

                try {

                    // ==================================
                    // 10. CALL API
                    // ==================================

                    const response =
                        await axios.get(
                            formats[selectedFormat],
                            {
                                timeout: 180000,

                                // Don't let Axios hide 500 response
                                validateStatus: () => true
                            }
                        );

                    const apiRes = response.data;

                    console.log(
                        "YTDL API STATUS:",
                        response.status
                    );

                    console.log(
                        "YTDL API RESPONSE:",
                        apiRes
                    );

                    // ==================================
                    // 11. CHECK HTTP ERROR
                    // ==================================

                    if (response.status !== 200) {

                        await conn.sendMessage(
                            senderID,
                            {
                                react: {
                                    text: "❌",
                                    key: receivedMsg.key
                                }
                            }
                        );

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ API Error\n\n` +
                                    `Quality: ${selectedFormat}\n` +
                                    `HTTP Status: ${response.status}\n\n` +
                                    `Try another quality.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    // ==================================
                    // 12. CHECK API RESPONSE
                    // ==================================

                    if (
                        !apiRes ||
                        apiRes.status !== true ||
                        !apiRes.result
                    ) {

                        await conn.sendMessage(
                            senderID,
                            {
                                react: {
                                    text: "❌",
                                    key: receivedMsg.key
                                }
                            }
                        );

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ Unable to download ${selectedFormat}.\n\n` +
                                    `Try another quality.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    const result =
                        apiRes.result;

                    // ==================================
                    // 13. GET VIDEO URL
                    // ==================================

                    const videoUrl =
                        result.video;

                    if (!videoUrl) {

                        await conn.sendMessage(
                            senderID,
                            {
                                react: {
                                    text: "❌",
                                    key: receivedMsg.key
                                }
                            }
                        );

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ No video URL found for ${selectedFormat}.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    // ==================================
                    // 14. UPLOAD REACTION
                    // ==================================

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬆️",
                                key: receivedMsg.key
                            }
                        }
                    );

                    // ==================================
                    // 15. SAFE FILE NAME
                    // ==================================

                    const safeTitle =
                        (data.title || "RANUMITHA_VIDEO")
                            .replace(/[\\/:*?"<>|]/g, "")
                            .replace(/\s+/g, " ")
                            .trim()
                            .substring(0, 100);

                    // ==================================
                    // 16. DOCUMENT
                    // ==================================

                    if (isDocument) {

                        await conn.sendMessage(
                            senderID,
                            {
                                document: {
                                    url: videoUrl
                                },

                                mimetype: "video/mp4",

                                fileName:
                                    `${safeTitle} - ${selectedFormat}.mp4`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );

                    }

                    // ==================================
                    // 17. NORMAL VIDEO
                    // ==================================

                    else {

                        await conn.sendMessage(
                            senderID,
                            {
                                video: {
                                    url: videoUrl
                                },

                                mimetype: "video/mp4",

                                caption:
                                    `*${data.title}*\n\n` +
                                    `*Quality:* ${selectedFormat}\n\n` +
                                    `> © RANUMITHA-X-MD`,

                                ptt: false
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    // ==================================
                    // 18. SUCCESS REACTION
                    // ==================================

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "✔️",
                                key: receivedMsg.key
                            }
                        }
                    );

                } catch (error) {

                    console.error(
                        "Download Error:",
                        error
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "❌",
                                key: receivedMsg.key
                            }
                        }
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            text:
                                `❌ Error downloading ${selectedFormat}\n\n` +
                                `${error.message}`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

            } catch (listenerError) {

                console.error(
                    "Reply Listener Error:",
                    listenerError
                );
            }
        });

    } catch (error) {

        console.error(
            "Video Command Error:",
            error
        );

        reply(
            "❌ An error occurred while processing your request. Please try again later."
        );
    }
});
