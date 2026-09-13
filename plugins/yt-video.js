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

        const host = u.hostname
            .toLowerCase()
            .replace(/^www\./, "");

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

        const host = u.hostname
            .toLowerCase()
            .replace(/^www\./, "");

        // youtu.be
        if (host === "youtu.be") {
            return u.pathname
                .replace(/^\/+/, "")
                .split("/")[0]
                .trim();
        }

        // Shorts
        if (u.pathname.startsWith("/shorts/")) {
            return u.pathname
                .split("/shorts/")[1]
                .split("/")[0]
                .trim();
        }

        // Watch
        const v = u.searchParams.get("v");

        if (v) {
            return v.trim();
        }

        // Embed
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
// CLEAN YOUTUBE URL
// ======================================================

function cleanYouTubeUrl(url) {

    const id = getYouTubeId(url);

    if (!id) return null;

    return `https://www.youtube.com/watch?v=${id}`;
}

// ======================================================
// GET YOUTUBE INFO
// ======================================================

async function getYouTubeInfo(url) {

    const videoId = getYouTubeId(url);

    if (!videoId) {
        throw new Error("Invalid YouTube video ID.");
    }

    console.log("YouTube Video ID:", videoId);

    let result = null;

    try {

        result = await yts({
            videoId: videoId
        });

    } catch (error) {

        console.log(
            "yt-search videoId failed:",
            error.message
        );
    }

    // Direct result
    if (
        result &&
        result.videoId
    ) {
        return result;
    }

    // Result videos
    if (
        result?.videos?.length
    ) {
        return result.videos[0];
    }

    // Fallback search
    try {

        const search =
            await yts(videoId);

        if (
            search?.videos?.length
        ) {
            return search.videos[0];
        }

    } catch (error) {

        console.log(
            "yt-search fallback failed:",
            error.message
        );
    }

    throw new Error(
        "Unable to get YouTube video information."
    );
}

// ======================================================
// API URL
// ======================================================

function createApiUrl(
    videoUrl,
    quality
) {

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
// DOWNLOAD STREAM - OPTIMIZED
// ======================================================

async function downloadFile(
    url,
    outputPath
) {

    const response =
        await axios.get(
            url,
            {
                responseType: "stream",

                timeout: 180000,

                maxContentLength: Infinity,

                maxBodyLength: Infinity,

                decompress: true,

                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",

                    "Accept":
                        "*/*",

                    "Connection":
                        "keep-alive"
                }
            }
        );

    return new Promise(
        (resolve, reject) => {

            const writer =
                fs.createWriteStream(
                    outputPath,
                    {
                        highWaterMark:
                            1024 * 1024
                    }
                );

            response.data.pipe(
                writer
            );

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
// FAST VIDEO + AUDIO MERGE
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
                    "-map 0:v:0",
                    "-map 1:a:0",

                    // DO NOT RE-ENCODE VIDEO
                    "-c:v copy",

                    // Fast audio encoding
                    "-c:a aac",
                    "-b:a 128k",

                    "-shortest",

                    // MP4 optimization
                    "-movflags +faststart",

                    "-threads 0"
                ])

                .format("mp4")

                .on(
                    "start",
                    command => {
                        console.log(
                            "FFmpeg:",
                            command
                        );
                    }
                )

                .on(
                    "end",
                    () => {
                        resolve(
                            outputPath
                        );
                    }
                )

                .on(
                    "error",
                    reject
                )

                .save(
                    outputPath
                );
        }
    );
}

// ======================================================
// CHECK FILE
// ======================================================

function isValidFile(file) {

    try {

        if (
            !fs.existsSync(file)
        ) {
            return false;
        }

        const size =
            fs.statSync(file).size;

        return size > 1000;

    } catch {

        return false;
    }
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
        // 2. VIDEO INFORMATION
        // ==================================================

        let data;
        let ytUrl;

        // ==================================================
        // DIRECT YOUTUBE / SHORTS
        // ==================================================

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

            console.log(
                "Direct YouTube ID:",
                videoId
            );

            data =
                await getYouTubeInfo(
                    query
                );

            ytUrl =
                cleanYouTubeUrl(
                    query
                );

            console.log(
                "Clean API URL:",
                ytUrl
            );
        }

        // ==================================================
        // NORMAL SEARCH
        // ==================================================

        else {

            let search;

            try {

                search =
                    await yts(
                        query
                    );

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

            data =
                search.videos[0];

            ytUrl =
                cleanYouTubeUrl(
                    data.url
                );

            if (!ytUrl) {
                ytUrl =
                    data.url;
            }
        }

        // ==================================================
        // SAFETY CHECK
        // ==================================================

        if (!data) {

            return reply(
                "*❌ No results found.*"
            );
        }

        if (!ytUrl) {

            return reply(
                "❌ Unable to get YouTube URL."
            );
        }

        console.log(
            "Selected YouTube:",
            ytUrl
        );

        // ==================================================
        // 3. ORIGINAL TEMPLATE
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
        // 4. SEND ONLY ONE MENU
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
        // 5. REPLY LISTENER
        // ==================================================

        replyHandler =
            async (msgData) => {

                let senderID;
                let receivedMsg;
                let selectedFormat =
                    null;

                try {

                    receivedMsg =
                        msgData
                            .messages?.[0];

                    if (
                        !receivedMsg?.message
                    ) {
                        return;
                    }

                    // ==================================================
                    // SAME CHAT
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
                        receivedMsg
                            .message
                            .conversation ||

                        receivedMsg
                            .message
                            .extendedTextMessage
                            ?.text ||

                        receivedMsg
                            .message
                            .imageMessage
                            ?.caption ||

                        receivedMsg
                            .message
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
                    // CHECK MENU REPLY
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

                    let targetFile =
                        finalOutput;

                    try {

                        // ==================================================
                        // API REQUEST
                        // ==================================================

                        const apiUrl =
                            createApiUrl(
                                ytUrl,
                                selectedFormat
                            );

                        console.log(
                            "DOWNLOAD API:",
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
                                            "application/json,text/plain,*/*",

                                        "Connection":
                                            "keep-alive"
                                    }
                                }
                            );

                        // ==================================================
                        // HTTP ERROR
                        // ==================================================

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

                        // ==================================================
                        // API VALIDATION
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
                        // RESULT
                        // ==================================================

                        const result =
                            apiRes.result;

                        // ==================================================
                        // COMBINED VIDEO URL
                        // ==================================================

                        const combinedUrl =
                            result.video_url ||
                            result.videoUrl ||
                            result.mp4 ||
                            result.combined ||
                            result.file;

                        // ==================================================
                        // VIDEO URL
                        // ==================================================

                        const videoUrl =
                            result.video ||
                            result.url ||
                            result.download;

                        // ==================================================
                        // AUDIO URL
                        // ==================================================

                        const audioUrl =
                            result.audio;

                        console.log(
                            "Combined URL:",
                            combinedUrl
                                ? "YES"
                                : "NO"
                        );

                        console.log(
                            "Video URL:",
                            videoUrl
                                ? "YES"
                                : "NO"
                        );

                        console.log(
                            "Audio URL:",
                            audioUrl
                                ? "YES"
                                : "NO"
                        );

                        // ==================================================
                        // FAST PATH
                        // COMBINED MP4
                        // ==================================================

                        if (
                            combinedUrl
                        ) {

                            console.log(
                                "Using combined MP4 - no FFmpeg merge."
                            );

                            await downloadFile(
                                combinedUrl,
                                finalOutput
                            );

                            targetFile =
                                finalOutput;
                        }

                        // ==================================================
                        // VIDEO + AUDIO
                        // ==================================================

                        else if (
                            videoUrl &&
                            audioUrl
                        ) {

                            console.log(
                                "Downloading video + audio in parallel..."
                            );

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
                                "Video + audio downloaded."
                            );

                            console.log(
                                "Fast FFmpeg merge..."
                            );

                            await mergeVideoAndAudio(
                                videoInput,
                                audioInput,
                                finalOutput
                            );

                            targetFile =
                                finalOutput;
                        }

                        // ==================================================
                        // VIDEO ONLY
                        // ==================================================

                        else if (
                            videoUrl
                        ) {

                            console.log(
                                "Video only."
                            );

                            await downloadFile(
                                videoUrl,
                                finalOutput
                            );

                            targetFile =
                                finalOutput;
                        }

                        else {

                            throw new Error(
                                `No downloadable URL found for ${selectedFormat}.`
                            );
                        }

                        // ==================================================
                        // VALIDATE
                        // ==================================================

                        if (
                            !isValidFile(
                                targetFile
                            )
                        ) {

                            throw new Error(
                                "Generated video file is invalid or empty."
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

                        for (
                            const file of [
                                videoInput,
                                audioInput,
                                finalOutput
                            ]
                        ) {

                            try {

                                if (
                                    fs.existsSync(
                                        file
                                    )
                                ) {
                                    fs.unlinkSync(
                                        file
                                    );
                                }

                            } catch (e) {

                                console.error(
                                    "Cleanup Error:",
                                    e.message
                                );
                            }
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
        // ADD LISTENER
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
