const axios = require("axios");
const yts = require("yt-search");
const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// ======================================================
// FAKE CHATGPT vCard
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
// YOUTUBE ID
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
// API URL
// ======================================================

function createApiUrl(videoUrl, quality) {

    const params = new URLSearchParams();

    params.set("url", videoUrl);
    params.set("quality", quality);

    // Keep API separate mode
    params.set("mode", "separate");

    return (
        "https://api-ytdlwsmd-mini.vercel.app/api/download?" +
        params.toString()
    );
}

// ======================================================
// EXTRACT VIDEO URL
// ======================================================

function extractVideoUrl(apiRes) {

    if (!apiRes) return null;

    if (apiRes.result?.video) {
        return apiRes.result.video;
    }

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

    return null;
}

// ======================================================
// DOWNLOAD STREAM TO FILE
// ======================================================

async function downloadFile(url, outputPath) {

    const response = await axios.get(
        url,
        {
            responseType: "stream",

            timeout: 180000,

            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",

                "Accept":
                    "*/*"
            }
        }
    );

    return new Promise((resolve, reject) => {

        const writer =
            fs.createWriteStream(outputPath);

        response.data.pipe(writer);

        writer.on(
            "finish",
            () => resolve(outputPath)
        );

        writer.on(
            "error",
            reject
        );
    });
}

// ======================================================
// CONVERT TO WHATSAPP COMPATIBLE MP4
// ======================================================

function convertToWhatsAppMP4(
    inputPath,
    outputPath
) {

    return new Promise((resolve, reject) => {

        ffmpeg(inputPath)

            // H.264 video
            .videoCodec("libx264")

            // AAC audio
            .audioCodec("aac")

            // Compatibility
            .outputOptions([
                "-preset veryfast",
                "-crf 23",

                "-pix_fmt yuv420p",

                "-movflags +faststart",

                "-profile:v main",

                "-level 3.1",

                "-ar 44100",

                "-ac 2",

                "-b:a 128k"
            ])

            .format("mp4")

            .on(
                "start",
                commandLine => {

                    console.log(
                        "FFMPEG:",
                        commandLine
                    );
                }
            )

            .on(
                "progress",
                progress => {

                    if (
                        progress.percent
                    ) {

                        console.log(
                            `Converting: ${progress.percent.toFixed(1)}%`
                        );
                    }
                }
            )

            .on(
                "end",
                () => {

                    console.log(
                        "MP4 conversion completed"
                    );

                    resolve(outputPath);
                }
            )

            .on(
                "error",
                error => {

                    console.error(
                        "FFMPEG ERROR:",
                        error
                    );

                    reject(error);
                }
            )

            .save(outputPath);
    });
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

async (
    conn,
    mek,
    m,
    { from, reply, q }
) => {

    try {

        // ==================================================
        // 1. QUERY
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
                "Or reply to a message with:\n" +
                "."
            );
        }

        // ==================================================
        // 2. SHORTS
        // ==================================================

        if (
            query.includes(
                "youtube.com/shorts/"
            ) ||
            query.includes("youtu.be/")
        ) {

            const videoId =
                getYouTubeId(query);

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
                "YouTube Search Error:",
                error
            );

            return reply(
                "❌ YouTube search failed.\nPlease try again."
            );
        }

        if (
            !search ||
            !search.videos ||
            !search.videos.length
        ) {

            return reply(
                "*❌ No results found.*"
            );
        }

        const data =
            search.videos[0];

        const ytUrl =
            data.url;

        // ==================================================
        // 4. TEMPLATE — UNCHANGED
        // ==================================================

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

        // ==================================================
        // 5. SEND MENU
        // ==================================================

        const sentMsg =
            await conn.sendMessage(
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

        const messageID =
            sentMsg.key.id;

        // ==================================================
        // 6. REPLY LISTENER
        // ==================================================

        const replyHandler =
            async (msgData) => {

            try {

                const receivedMsg =
                    msgData.messages?.[0];

                if (
                    !receivedMsg?.message
                ) {
                    return;
                }

                const senderID =
                    receivedMsg.key.remoteJid;

                if (
                    senderID !== from
                ) {
                    return;
                }

                const receivedText =
                    receivedMsg
                        .message
                        .conversation ||
                    receivedMsg
                        .message
                        .extendedTextMessage
                        ?.text;

                if (!receivedText) {
                    return;
                }

                const contextInfo =
                    receivedMsg
                        .message
                        .extendedTextMessage
                        ?.contextInfo;

                const isReply =
                    contextInfo?.stanzaId ===
                    messageID;

                if (!isReply) {
                    return;
                }

                // ==================================================
                // 7. QUALITY
                // ==================================================

                let selectedFormat;
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
                                    "*❌ Invalid option!*\n\n" +
                                    "Reply with 1.1 - 2.5."
                            },
                            {
                                quoted:
                                    receivedMsg
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
                // 9. TEMP DIRECTORY
                // ==================================================

                const tempDir =
                    path.join(
                        process.cwd(),
                        "temp"
                    );

                if (
                    !fs.existsSync(tempDir)
                ) {

                    fs.mkdirSync(
                        tempDir,
                        {
                            recursive: true
                        }
                    );
                }

                const uniqueID =
                    `${Date.now()}_${Math.random()
                        .toString(36)
                        .substring(2, 8)}`;

                const inputFile =
                    path.join(
                        tempDir,
                        `${uniqueID}_input`
                    );

                const outputFile =
                    path.join(
                        tempDir,
                        `${uniqueID}.mp4`
                    );

                try {

                    // ==================================================
                    // 10. API REQUEST
                    // ==================================================

                    const apiUrl =
                        createApiUrl(
                            ytUrl,
                            selectedFormat
                        );

                    console.log(
                        "API:",
                        apiUrl
                    );

                    const response =
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
                                        "application/json,text/plain,*/*"
                                }
                            }
                        );

                    console.log(
                        "API STATUS:",
                        response.status
                    );

                    console.log(
                        "API RESPONSE:",
                        JSON.stringify(
                            response.data,
                            null,
                            2
                        )
                    );

                    // ==================================================
                    // 11. API ERROR
                    // ==================================================

                    if (
                        response.status !== 200
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
                                    `❌ API Error\n\n` +
                                    `Quality: ${selectedFormat}\n` +
                                    `HTTP Status: ${response.status}\n\n` +
                                    `Try again.`
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );
                    }

                    const apiRes =
                        response.data;

                    // ==================================================
                    // 12. API RESULT
                    // ==================================================

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
                                    `❌ Unable to download ${selectedFormat}.`
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );
                    }

                    const videoUrl =
                        extractVideoUrl(
                            apiRes
                        );

                    if (!videoUrl) {

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ No video URL found for ${selectedFormat}.`
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );
                    }

                    // ==================================================
                    // 13. DOWNLOAD ORIGINAL STREAM
                    // ==================================================

                    console.log(
                        `Downloading ${selectedFormat} stream...`
                    );

                    await downloadFile(
                        videoUrl,
                        inputFile
                    );

                    // ==================================================
                    // 14. CONVERT TO REAL MP4
                    // ==================================================

                    console.log(
                        "Converting to WhatsApp MP4..."
                    );

                    await convertToWhatsAppMP4(
                        inputFile,
                        outputFile
                    );

                    // ==================================================
                    // 15. CHECK OUTPUT
                    // ==================================================

                    if (
                        !fs.existsSync(
                            outputFile
                        )
                    ) {

                        throw new Error(
                            "FFmpeg did not create MP4 file."
                        );
                    }

                    const stats =
                        fs.statSync(
                            outputFile
                        );

                    if (stats.size < 1000) {

                        throw new Error(
                            "Generated MP4 file is invalid."
                        );
                    }

                    // ==================================================
                    // 16. UPLOAD REACTION
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
                    // 17. SAFE FILE NAME
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
                    // 18. DOCUMENT
                    // ==================================================

                    if (isDocument) {

                        await conn.sendMessage(
                            senderID,
                            {
                                document: {
                                    url: outputFile
                                },

                                mimetype:
                                    "video/mp4",

                                fileName:
                                    `${safeTitle} - ${selectedFormat}.mp4`
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );

                    }

                    // ==================================================
                    // 19. NORMAL VIDEO
                    // ==================================================

                    else {

                        await conn.sendMessage(
                            senderID,
                            {
                                video: {
                                    url: outputFile
                                },

                                mimetype:
                                    "video/mp4",

                                caption:
                                    `*${data.title}*\n\n` +
                                    `*Quality:* ${selectedFormat}\n\n` +
                                    `> © RANUMITHA-X-MD`,

                                ptt: false
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );
                    }

                    // ==================================================
                    // 20. SUCCESS
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

                } finally {

                    // ==================================================
                    // 21. DELETE TEMP FILES
                    // ==================================================

                    try {

                        if (
                            fs.existsSync(
                                inputFile
                            )
                        ) {

                            fs.unlinkSync(
                                inputFile
                            );
                        }

                    } catch (e) {

                        console.error(
                            "Input cleanup error:",
                            e.message
                        );
                    }

                    try {

                        if (
                            fs.existsSync(
                                outputFile
                            )
                        ) {

                            fs.unlinkSync(
                                outputFile
                            );
                        }

                    } catch (e) {

                        console.error(
                            "Output cleanup error:",
                            e.message
                        );
                    }
                }

                // ==================================================
                // 22. REMOVE LISTENER
                // ==================================================

                conn.ev.off(
                    "messages.upsert",
                    replyHandler
                );

            } catch (error) {

                console.error(
                    "Video Download Error:",
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
                            quoted:
                                receivedMsg
                        }
                    );

                } catch (sendError) {

                    console.error(
                        "Send Error:",
                        sendError
                    );
                }
            }
        };

        // ==================================================
        // 23. LISTENER
        // ==================================================

        conn.ev.on(
            "messages.upsert",
            replyHandler
        );

        // ==================================================
        // 24. AUTO CLEAN LISTENER
        // ==================================================

        setTimeout(() => {

            try {

                conn.ev.off(
                    "messages.upsert",
                    replyHandler
                );

            } catch (e) {}

        }, 5 * 60 * 1000);

    } catch (error) {

        console.error(
            "Video Command Error:",
            error
        );

        return reply(
            "❌ An error occurred while processing the video.\n\n" +
            error.message
        );
    }
});
