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
// CHECK YOUTUBE URL
// ======================================================

function isYouTubeUrl(text) {
    if (!text) return false;

    try {
        const u = new URL(text.trim());
        const host = u.hostname.toLowerCase().replace(/^www\./, "");

        return (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "music.youtube.com" ||
            host === "youtu.be"
        );

    } catch {
        return false;
    }
}

// ======================================================
// YOUTUBE ID
// ======================================================

function getYouTubeId(url) {

    try {

        const u = new URL(url.trim());

        const host =
            u.hostname
                .toLowerCase()
                .replace(/^www\./, "");

        // ----------------------------------------------
        // youtu.be/VIDEO_ID
        // ----------------------------------------------

        if (host === "youtu.be") {

            return u.pathname
                .replace(/^\/+/, "")
                .split("/")[0]
                .split("?")[0]
                .trim();
        }

        // ----------------------------------------------
        // youtube.com/shorts/VIDEO_ID
        // ----------------------------------------------

        if (u.pathname.startsWith("/shorts/")) {

            return u.pathname
                .split("/shorts/")[1]
                .split("/")[0]
                .split("?")[0]
                .trim();
        }

        // ----------------------------------------------
        // youtube.com/watch?v=VIDEO_ID
        // ----------------------------------------------

        const v =
            u.searchParams.get("v");

        if (v) {
            return v.trim();
        }

        // ----------------------------------------------
        // youtube.com/embed/VIDEO_ID
        // ----------------------------------------------

        if (u.pathname.startsWith("/embed/")) {

            return u.pathname
                .split("/embed/")[1]
                .split("/")[0]
                .trim();
        }

        return null;

    } catch {
        return null;
    }
}

// ======================================================
// NORMALIZE YOUTUBE URL
// ======================================================

function normalizeYouTubeUrl(url) {

    try {

        const videoId =
            getYouTubeId(url);

        if (!videoId) {
            return null;
        }

        // Always send a clean watch URL to the API.
        // This works for normal videos AND Shorts.

        return `https://www.youtube.com/watch?v=${videoId}`;

    } catch {
        return null;
    }
}

// ======================================================
// API URL
// ======================================================

function createApiUrl(videoUrl, quality) {

    const params =
        new URLSearchParams();

    params.set(
        "url",
        videoUrl
    );

    params.set(
        "quality",
        quality
    );

    params.set(
        "mode",
        "separate"
    );

    return (
        "https://api-ytdlwsmd-mini.vercel.app/api/download?" +
        params.toString()
    );
}

// ======================================================
// DOWNLOAD STREAM
// ======================================================

async function downloadFile(url, outputPath) {

    const response =
        await axios.get(url, {

            responseType: "stream",

            timeout: 180000,

            maxContentLength:
                Infinity,

            maxBodyLength:
                Infinity,

            headers: {

                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",

                "Accept":
                    "*/*"
            }
        });

    return new Promise(
        (resolve, reject) => {

            const writer =
                fs.createWriteStream(
                    outputPath
                );

            response.data.pipe(writer);

            writer.on(
                "finish",
                () => {

                    writer.close();

                    resolve(
                        outputPath
                    );
                }
            );

            writer.on(
                "error",
                reject
            );

            response.data.on(
                "error",
                reject
            );
        }
    );
}

// ======================================================
// MERGE VIDEO + AUDIO
// ======================================================

function mergeVideoAndAudio(
    videoPath,
    audioPath,
    outputPath
) {

    return new Promise(
        (resolve, reject) => {

            ffmpeg()

                .input(videoPath)

                .input(audioPath)

                .outputOptions([

                    "-c:v copy",

                    "-c:a aac",

                    "-map 0:v:0",

                    "-map 1:a:0",

                    "-shortest"

                ])

                .save(outputPath)

                .on(
                    "end",
                    () =>
                        resolve(
                            outputPath
                        )
                )

                .on(
                    "error",
                    reject
                );
        }
    );
}

// ======================================================
// MAIN COMMAND
// ======================================================

cmd({

    pattern: "video",

    alias: [
        "ytvideo",
        "."
    ],

    react: "🎬",

    desc:
        "Download YouTube MP4",

    category:
        "download",

    use:
        ".video <query>",

    filename:
        __filename

},

async (
    conn,
    mek,
    m,
    {
        from,
        reply,
        q
    }
) => {

    let replyHandler;

    try {

        // ==================================================
        // 1. QUERY
        // ==================================================

        let query =
            q?.trim();

        if (
            !query &&
            m?.quoted
        ) {

            query =
                getReplyText(m);
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
        // 2. YOUTUBE LINK / SHORTS
        // ==================================================

        let directYouTubeUrl = null;

        if (
            isYouTubeUrl(query)
        ) {

            const videoId =
                getYouTubeId(query);

            if (!videoId) {

                return reply(
                    "❌ Invalid YouTube link."
                );
            }

            directYouTubeUrl =
                normalizeYouTubeUrl(
                    query
                );

            console.log(
                "YouTube URL:",
                query
            );

            console.log(
                "YouTube ID:",
                videoId
            );

            console.log(
                "Normalized URL:",
                directYouTubeUrl
            );
        }

        // ==================================================
        // 3. YOUTUBE SEARCH
        // ==================================================

        let search;

        try {

            if (directYouTubeUrl) {

                // Search using the clean URL so yt-search
                // can retrieve the correct metadata.

                search =
                    await yts(
                        directYouTubeUrl
                    );

            } else {

                search =
                    await yts(
                        query
                    );
            }

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

        // ==================================================
        // 4. SELECT VIDEO
        // ==================================================

        const data =
            search.videos[0];

        // ==================================================
        // IMPORTANT:
        // IF USER PROVIDED A YOUTUBE / SHORTS LINK,
        // USE THAT EXACT VIDEO ID.
        // ==================================================

        let ytUrl =
            directYouTubeUrl ||
            data.url;

        // If search returned a URL, normalize it too.

        if (
            !directYouTubeUrl &&
            isYouTubeUrl(ytUrl)
        ) {

            ytUrl =
                normalizeYouTubeUrl(
                    ytUrl
                );
        }

        console.log(
            "Selected YouTube:",
            ytUrl
        );

        // ==================================================
        // 5. TEMPLATE
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
        // 6. SEND MENU
        // ==================================================

        const sentMsg =
            await conn.sendMessage(
                from,
                {
                    image: {
                        url:
                            data.thumbnail
                    },

                    caption:
                        caption
                },
                {
                    quoted:
                        fakevCard
                }
            );

        const messageID =
            sentMsg.key.id;

        console.log(
            "VIDEO MENU ID:",
            messageID
        );

        // ==================================================
        // 7. REPLY LISTENER
        // ==================================================

        replyHandler =
            async (msgData) => {

                let senderID;
                let receivedMsg;
                let selectedFormat =
                    null;

                try {

                    receivedMsg =
                        msgData.messages?.[0];

                    if (
                        !receivedMsg?.message
                    ) {
                        return;
                    }

                    // ==================================================
                    // SAME CHAT ONLY
                    // ==================================================

                    senderID =
                        receivedMsg
                            .key
                            .remoteJid;

                    if (
                        senderID !== from
                    ) {
                        return;
                    }

                    // ==================================================
                    // GET TEXT
                    // ==================================================

                    const receivedText =
                        receivedMsg.message
                            .conversation ||

                        receivedMsg.message
                            .extendedTextMessage
                            ?.text ||

                        receivedMsg.message
                            .imageMessage
                            ?.caption ||

                        receivedMsg.message
                            .videoMessage
                            ?.caption ||

                        "";

                    if (
                        !receivedText
                    ) {
                        return;
                    }

                    const option =
                        receivedText
                            .trim()
                            .toLowerCase();

                    // ==================================================
                    // CHECK REPLY
                    // ==================================================

                    const contextInfo =
                        receivedMsg
                            .message
                            .extendedTextMessage
                            ?.contextInfo;

                    const quotedMessageID =
                        contextInfo
                            ?.stanzaId;

                    if (
                        quotedMessageID !==
                        messageID
                    ) {
                        return;
                    }

                    console.log(
                        "MENU REPLY:",
                        option
                    );

                    // ==================================================
                    // QUALITY
                    // ==================================================

                    let isDocument =
                        false;

                    switch (option) {

                        case "1.1":
                            selectedFormat =
                                "144p";
                            break;

                        case "1.2":
                            selectedFormat =
                                "360p";
                            break;

                        case "1.3":
                            selectedFormat =
                                "480p";
                            break;

                        case "1.4":
                            selectedFormat =
                                "720p";
                            break;

                        case "1.5":
                            selectedFormat =
                                "1080p";
                            break;

                        case "2.1":
                            selectedFormat =
                                "144p";
                            isDocument =
                                true;
                            break;

                        case "2.2":
                            selectedFormat =
                                "360p";
                            isDocument =
                                true;
                            break;

                        case "2.3":
                            selectedFormat =
                                "480p";
                            isDocument =
                                true;
                            break;

                        case "2.4":
                            selectedFormat =
                                "720p";
                            isDocument =
                                true;
                            break;

                        case "2.5":
                            selectedFormat =
                                "1080p";
                            isDocument =
                                true;
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
                    // DOWNLOAD REACTION
                    // ==================================================

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬇️",
                                key:
                                    receivedMsg.key
                            }
                        }
                    );

                    // ==================================================
                    // TEMP DIRECTORY
                    // ==================================================

                    const tempDir =
                        path.join(
                            process.cwd(),
                            "temp"
                        );

                    if (
                        !fs.existsSync(
                            tempDir
                        )
                    ) {

                        fs.mkdirSync(
                            tempDir,
                            {
                                recursive:
                                    true
                            }
                        );
                    }

                    // ==================================================
                    // UNIQUE FILES
                    // ==================================================

                    const uniqueID =
                        `${Date.now()}_${Math.random()
                            .toString(36)
                            .substring(2, 8)}`;

                    const videoInput =
                        path.join(
                            tempDir,
                            `${uniqueID}_video.mp4`
                        );

                    const audioInput =
                        path.join(
                            tempDir,
                            `${uniqueID}_audio.mp3`
                        );

                    const finalOutput =
                        path.join(
                            tempDir,
                            `${uniqueID}_final.mp4`
                        );

                    try {

                        // ==================================================
                        // API
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

                                    timeout:
                                        180000,

                                    maxContentLength:
                                        Infinity,

                                    maxBodyLength:
                                        Infinity,

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

                        if (
                            response.status !==
                            200
                        ) {

                            await conn.sendMessage(
                                senderID,
                                {
                                    react: {
                                        text: "❌",
                                        key:
                                            receivedMsg.key
                                    }
                                }
                            );

                            return conn.sendMessage(
                                senderID,
                                {
                                    text:
                                        `❌ API Error\n\n` +
                                        `Quality: ${selectedFormat}\n` +
                                        `HTTP Status: ${response.status}`
                                },
                                {
                                    quoted:
                                        receivedMsg
                                }
                            );
                        }

                        const apiRes =
                            response.data;

                        console.log(
                            "API RESPONSE:",
                            JSON.stringify(
                                apiRes,
                                null,
                                2
                            )
                        );

                        if (
                            !apiRes ||
                            apiRes.status !==
                                true ||
                            !apiRes.result
                        ) {

                            await conn.sendMessage(
                                senderID,
                                {
                                    react: {
                                        text: "❌",
                                        key:
                                            receivedMsg.key
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

                        // ==================================================
                        // VIDEO URL
                        // ==================================================

                        const videoUrl =
                            apiRes.result.video ||
                            apiRes.result.url ||
                            apiRes.result.download;

                        // ==================================================
                        // AUDIO URL
                        // ==================================================

                        const audioUrl =
                            apiRes.result.audio;

                        if (
                            !videoUrl
                        ) {

                            throw new Error(
                                `No video URL found for ${selectedFormat}.`
                            );
                        }

                        console.log(
                            "Video URL received."
                        );

                        console.log(
                            "Audio URL:",
                            audioUrl
                                ? "YES"
                                : "NO"
                        );

                        // ==================================================
                        // DOWNLOAD
                        // ==================================================

                        let targetFile =
                            finalOutput;

                        if (
                            audioUrl
                        ) {

                            await Promise.all([

                                downloadFile(
                                    videoUrl,
                                    videoInput
                                ),

                                downloadFile(
                                    audioUrl,
                                    audioInput
                                )

                            ]);

                            console.log(
                                "Merging video and audio..."
                            );

                            await mergeVideoAndAudio(
                                videoInput,
                                audioInput,
                                finalOutput
                            );

                            targetFile =
                                finalOutput;

                        } else {

                            await downloadFile(
                                videoUrl,
                                finalOutput
                            );

                            targetFile =
                                finalOutput;
                        }

                        // ==================================================
                        // VALIDATE FILE
                        // ==================================================

                        if (
                            !fs.existsSync(
                                targetFile
                            )
                        ) {

                            throw new Error(
                                "Generated video file does not exist."
                            );
                        }

                        const fileSize =
                            fs.statSync(
                                targetFile
                            ).size;

                        console.log(
                            "Final file size:",
                            fileSize
                        );

                        if (
                            fileSize <
                            1000
                        ) {

                            throw new Error(
                                "Generated video file is invalid."
                            );
                        }

                        // ==================================================
                        // UPLOAD REACTION
                        // ==================================================

                        await conn.sendMessage(
                            senderID,
                            {
                                react: {
                                    text: "⬆️",
                                    key:
                                        receivedMsg.key
                                }
                            }
                        );

                        // ==================================================
                        // SAFE FILE NAME
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
                        // DOCUMENT
                        // ==================================================

                        if (
                            isDocument
                        ) {

                            await conn.sendMessage(
                                senderID,
                                {

                                    document: {
                                        url:
                                            targetFile
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
                        // NORMAL VIDEO
                        // ==================================================

                        else {

                            await conn.sendMessage(
                                senderID,
                                {

                                    video: {
                                        url:
                                            targetFile
                                    },

                                    mimetype:
                                        "video/mp4",

                                    caption:
                                        `*${data.title}*\n\n` +
                                        `*Quality:* ${selectedFormat}\n\n` +
                                        `> © RANUMITHA-X-MD`,

                                    ptt:
                                        false

                                },
                                {
                                    quoted:
                                        receivedMsg
                                }
                            );
                        }

                        // ==================================================
                        // SUCCESS
                        // ==================================================

                        await conn.sendMessage(
                            senderID,
                            {
                                react: {
                                    text: "✔️",
                                    key:
                                        receivedMsg.key
                                }
                            }
                        );

                    } finally {

                        // ==================================================
                        // CLEANUP
                        // ==================================================

                        try {

                            if (
                                fs.existsSync(
                                    videoInput
                                )
                            ) {
                                fs.unlinkSync(
                                    videoInput
                                );
                            }

                            if (
                                fs.existsSync(
                                    audioInput
                                )
                            ) {
                                fs.unlinkSync(
                                    audioInput
                                );
                            }

                            if (
                                fs.existsSync(
                                    finalOutput
                                )
                            ) {
                                fs.unlinkSync(
                                    finalOutput
                                );
                            }

                        } catch (e) {

                            console.error(
                                "Cleanup Error:",
                                e.message
                            );
                        }
                    }

                } catch (error) {

                    console.error(
                        "Video Download Error:",
                        error
                    );

                    try {

                        if (
                            senderID &&
                            receivedMsg
                        ) {

                            await conn.sendMessage(
                                senderID,
                                {
                                    react: {
                                        text: "❌",
                                        key:
                                            receivedMsg.key
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
                        }

                    } catch (
                        sendError
                    ) {

                        console.error(
                            "Send Error:",
                            sendError
                        );
                    }
                }
            };

        // ==================================================
        // 8. ADD LISTENER
        // ==================================================

        conn.ev.on(
            "messages.upsert",
            replyHandler
        );

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
