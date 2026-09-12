const axios = require("axios");
const yts = require("yt-search");
const { cmd } = require("../command");

// ======================================================
// FAKE vCARD
// ======================================================

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

// ======================================================
// GET TEXT FROM REPLIED MESSAGE
// ======================================================

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

// ======================================================
// EXTRACT YOUTUBE VIDEO ID
// ======================================================

function getYouTubeId(url) {
    try {
        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.substring(1).split("/")[0];
        }

        if (u.searchParams.get("v")) {
            return u.searchParams.get("v");
        }

        if (u.pathname.includes("/shorts/")) {
            return u.pathname
                .split("/shorts/")[1]
                .split("/")[0];
        }

        return null;
    } catch {
        return null;
    }
}

// ======================================================
// CREATE API URL
// ======================================================

function createApiUrl(videoUrl, quality) {

    const params = new URLSearchParams();

    params.set("url", videoUrl);
    params.set("quality", quality);
    params.set("mode", "separate");

    return (
        "https://api-ytdlwsmd-mini.vercel.app/api/download?" +
        params.toString()
    );
}

// ======================================================
// GET VIDEO URL FROM API RESPONSE
// ======================================================

function extractVideoUrl(apiRes) {

    if (!apiRes) return null;

    // Standard API response
    if (apiRes.result?.video) {
        return apiRes.result.video;
    }

    // Other possible structures
    if (apiRes.result?.url) {
        return apiRes.result.url;
    }

    if (apiRes.result?.download) {
        return apiRes.result.download;
    }

    if (apiRes.video) {
        return apiRes.video;
    }

    if (apiRes.url) {
        return apiRes.url;
    }

    if (apiRes.download) {
        return apiRes.download;
    }

    return null;
}

// ======================================================
// MAIN COMMAND
// ======================================================

cmd({
    pattern: "video",
    alias: ["ytvideo", "."],
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
},

async (conn, mek, m, { from, reply, q }) => {

    try {

        // ==================================================
        // 1. GET QUERY
        // ==================================================

        let query = q?.trim();

        if (!query && m?.quoted) {
            query = getReplyText(m);
        }

        if (!query) {

            return reply(
                "⚠️ Please provide a video name or YouTube link.\n\n" +
                "Example:\n" +
                ".video Nilan Hettiarachchi\n\n" +
                "Or reply to a YouTube link with:\n" +
                "."
            );
        }

        // ==================================================
        // 2. SHORTS LINK
        // ==================================================

        if (
            query.includes("youtube.com/shorts/") ||
            query.includes("youtu.be/")
        ) {

            const videoId = getYouTubeId(query);

            if (!videoId) {
                return reply(
                    "❌ Invalid YouTube link."
                );
            }

            query =
                `https://www.youtube.com/watch?v=${videoId}`;
        }

        // ==================================================
        // 3. YOUTUBE SEARCH
        // ==================================================

        let search;

        try {

            search = await yts(query);

        } catch (error) {

            console.error(
                "YT SEARCH ERROR:",
                error
            );

            return reply(
                "❌ YouTube search failed.\nPlease try again."
            );
        }

        if (
            !search ||
            !search.videos ||
            search.videos.length === 0
        ) {

            return reply(
                "❌ No YouTube results found."
            );
        }

        const data = search.videos[0];

        const ytUrl = data.url;

        // ==================================================
        // 4. MENU
        // ==================================================

        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 Title:* ${data.title}
*⏱️ Duration:* ${data.timestamp}
*📆 Uploaded:* ${data.ago}
*📊 Views:* ${data.views}
*🔗 Link:* ${data.url}

🔢 *Reply With Number*

1. *VIDEO FILE 📽️*
   1.1 144p
   1.2 360p
   1.3 480p
   1.4 720p
   1.5 1080p

2. *DOCUMENT FILE 📂*
   2.1 144p
   2.2 360p
   2.3 480p
   2.4 720p
   2.5 1080p

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛
`;

        // ==================================================
        // 5. SEND MENU
        // ==================================================

        const sentMsg = await conn.sendMessage(
            from,
            {
                image: {
                    url: data.thumbnail
                },
                caption
            },
            {
                quoted: fakevCard
            }
        );

        const messageID = sentMsg.key.id;

        // ==================================================
        // 6. REPLY LISTENER
        // ==================================================

        const replyHandler = async (msgData) => {

            try {

                const receivedMsg =
                    msgData.messages?.[0];

                if (!receivedMsg?.message) {
                    return;
                }

                const senderID =
                    receivedMsg.key.remoteJid;

                // Same chat only
                if (senderID !== from) {
                    return;
                }

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text ||
                    "";

                if (!receivedText) {
                    return;
                }

                const contextInfo =
                    receivedMsg
                        .message
                        .extendedTextMessage
                        ?.contextInfo;

                const isReply =
                    contextInfo?.stanzaId === messageID;

                if (!isReply) {
                    return;
                }

                // ==================================================
                // 7. QUALITY SELECTION
                // ==================================================

                let selectedFormat = null;
                let isDocument = false;

                switch (
                    receivedText
                        .trim()
                        .toLowerCase()
                ) {

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
                                text:
                                    "❌ Invalid option!\n\n" +
                                    "Reply with 1.1 - 2.5."
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                }

                // ==================================================
                // 8. DOWNLOAD REACTION
                // ==================================================

                await conn.sendMessage(
                    senderID,
                    {
                        react: {
                            text: "⬇️",
                            key: receivedMsg.key
                        }
                    }
                );

                // ==================================================
                // 9. API REQUEST
                // ==================================================

                let apiResponse = null;
                let apiError = null;

                const apiUrl =
                    createApiUrl(
                        ytUrl,
                        selectedFormat
                    );

                console.log(
                    "================================"
                );

                console.log(
                    "RANUMITHA YTDL"
                );

                console.log(
                    "QUALITY:",
                    selectedFormat
                );

                console.log(
                    "YOUTUBE:",
                    ytUrl
                );

                console.log(
                    "API:",
                    apiUrl
                );

                console.log(
                    "================================"
                );

                // ==================================================
                // 10. RETRY API
                // ==================================================

                for (
                    let attempt = 1;
                    attempt <= 2;
                    attempt++
                ) {

                    try {

                        apiResponse =
                            await axios.get(
                                apiUrl,
                                {
                                    timeout: 180000,

                                    validateStatus:
                                        () => true,

                                    headers: {
                                        "User-Agent":
                                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",

                                        "Accept":
                                            "application/json,text/plain,*/*",

                                        "Referer":
                                            "https://api-ytdlwsmd-mini.vercel.app/"
                                    }
                                }
                            );

                        console.log(
                            `API ATTEMPT ${attempt}:`,
                            apiResponse.status
                        );

                        // Success
                        if (
                            apiResponse.status === 200
                        ) {
                            break;
                        }

                        // Retry 500
                        if (
                            apiResponse.status >= 500 &&
                            attempt < 2
                        ) {

                            console.log(
                                "Retrying API..."
                            );

                            await new Promise(
                                resolve =>
                                    setTimeout(
                                        resolve,
                                        1500
                                    )
                            );
                        }

                    } catch (error) {

                        apiError = error;

                        console.error(
                            `API ATTEMPT ${attempt} ERROR:`,
                            error.message
                        );

                        if (attempt < 2) {

                            await new Promise(
                                resolve =>
                                    setTimeout(
                                        resolve,
                                        1500
                                    )
                            );
                        }
                    }
                }

                // ==================================================
                // 11. AXIOS ERROR
                // ==================================================

                if (!apiResponse) {

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
                                `❌ API connection failed.\n\n` +
                                `Quality: ${selectedFormat}\n` +
                                `${apiError?.message || "Unknown error"}`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

                // ==================================================
                // 12. LOG API RESPONSE
                // ==================================================

                console.log(
                    "API STATUS:",
                    apiResponse.status
                );

                console.log(
                    "API DATA:",
                    JSON.stringify(
                        apiResponse.data,
                        null,
                        2
                    )
                );

                // ==================================================
                // 13. HTTP ERROR
                // ==================================================

                if (
                    apiResponse.status !== 200
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

                    const errorData =
                        apiResponse.data || {};

                    const errorMessage =
                        errorData.message ||
                        errorData.error ||
                        errorData.msg ||
                        "API server returned an error.";

                    return conn.sendMessage(
                        senderID,
                        {
                            text:
                                `❌ Download failed\n\n` +
                                `🎞️ Quality: ${selectedFormat}\n` +
                                `📡 HTTP: ${apiResponse.status}\n` +
                                `⚠️ ${errorMessage}\n\n` +
                                `Please try again.`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

                // ==================================================
                // 14. CHECK API STATUS
                // ==================================================

                const apiRes =
                    apiResponse.data;

                if (
                    !apiRes ||
                    apiRes.status !== true
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
                                `❌ API could not generate ${selectedFormat}.\n\n` +
                                `Try another quality.`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

                // ==================================================
                // 15. CHECK ACTUAL QUALITY
                // ==================================================

                const actualQuality =
                    apiRes.result?.quality;

                console.log(
                    "REQUESTED QUALITY:",
                    selectedFormat
                );

                console.log(
                    "API QUALITY:",
                    actualQuality
                );

                // ==================================================
                // 16. GET VIDEO URL
                // ==================================================

                const videoUrl =
                    extractVideoUrl(apiRes);

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
                                `❌ Video URL not found.\n\n` +
                                `Quality: ${selectedFormat}`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

                // ==================================================
                // 17. UPLOAD REACTION
                // ==================================================

                await conn.sendMessage(
                    senderID,
                    {
                        react: {
                            text: "⬆️",
                            key: receivedMsg.key
                        }
                    }
                );

                // ==================================================
                // 18. SAFE FILE NAME
                // ==================================================

                const safeTitle =
                    (
                        data.title ||
                        "RANUMITHA_VIDEO"
                    )
                        .replace(
                            /[\\/:*?"<>|]/g,
                            ""
                        )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim()
                        .substring(
                            0,
                            100
                        );

                // ==================================================
                // 19. SEND DOCUMENT
                // ==================================================

                if (isDocument) {

                    await conn.sendMessage(
                        senderID,
                        {
                            document: {
                                url: videoUrl
                            },

                            mimetype:
                                "video/mp4",

                            fileName:
                                `${safeTitle} - ${selectedFormat}.mp4`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );

                }

                // ==================================================
                // 20. SEND NORMAL VIDEO
                // ==================================================

                else {

                    await conn.sendMessage(
                        senderID,
                        {
                            video: {
                                url: videoUrl
                            },

                            mimetype:
                                "video/mp4",

                            caption:
                                `*${data.title}*\n\n` +
                                `*Quality:* ${actualQuality || selectedFormat}\n\n` +
                                `> © RANUMITHA-X-MD`,

                            ptt: false
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

                // ==================================================
                // 21. SUCCESS REACTION
                // ==================================================

                await conn.sendMessage(
                    senderID,
                    {
                        react: {
                            text: "✔️",
                            key: receivedMsg.key
                        }
                    }
                );

                // ==================================================
                // 22. REMOVE LISTENER
                // ==================================================

                conn.ev.off(
                    "messages.upsert",
                    replyHandler
                );

                console.log(
                    `SUCCESS: ${selectedFormat}`
                );

            } catch (error) {

                console.error(
                    "Reply Handler Error:",
                    error
                );

                try {

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
                                `❌ Error downloading ${selectedFormat || "video"}\n\n` +
                                `${error.message}`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );

                } catch (sendError) {

                    console.error(
                        "Error sending error message:",
                        sendError
                    );
                }
            }
        };

        // ==================================================
        // REGISTER LISTENER
        // ==================================================

        conn.ev.on(
            "messages.upsert",
            replyHandler
        );

        // ==================================================
        // AUTO REMOVE AFTER 5 MINUTES
        // ==================================================

        setTimeout(() => {

            try {

                conn.ev.off(
                    "messages.upsert",
                    replyHandler
                );

            } catch (error) {

                console.error(
                    "Listener cleanup error:",
                    error
                );
            }

        }, 5 * 60 * 1000);

    } catch (error) {

        console.error(
            "VIDEO COMMAND ERROR:",
            error
        );

        return reply(
            "❌ An error occurred while processing the video.\n\n" +
            error.message
        );
    }
});

 
