const axios = require("axios");
const yts = require("yt-search");
const ytdl = require("@distube/ytdl-core");
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
// YOUTUBE URL CHECK
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

        const host =
            u.hostname
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
        if (
            u.pathname.startsWith("/shorts/")
        ) {

            return u.pathname
                .split("/shorts/")[1]
                .split("/")[0]
                .trim();
        }

        // Watch
        const v =
            u.searchParams.get("v");

        if (v) {
            return v.trim();
        }

        // Embed
        if (
            u.pathname.startsWith("/embed/")
        ) {

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

    const id =
        getYouTubeId(url);

    if (!id) return null;

    return `https://www.youtube.com/watch?v=${id}`;
}

// ======================================================
// QUALITY NUMBER
// ======================================================

function qualityHeight(quality) {

    const map = {
        "144p": 144,
        "360p": 360,
        "480p": 480,
        "720p": 720,
        "1080p": 1080
    };

    return map[quality] || 360;
}

// ======================================================
// DOWNLOAD YOUTUBE VIDEO DIRECTLY
// ======================================================

async function downloadYouTubeVideo(
    url,
    quality,
    outputPath
) {

    console.log(
        "Starting direct YouTube download..."
    );

    console.log(
        "URL:",
        url
    );

    console.log(
        "Quality:",
        quality
    );

    // ==================================================
    // GET VIDEO INFO
    // ==================================================

    const info =
        await ytdl.getInfo(url);

    if (
        !info ||
        !info.videoDetails
    ) {

        throw new Error(
            "Unable to get YouTube video information."
        );
    }

    const requestedHeight =
        qualityHeight(quality);

    console.log(
        "Requested height:",
        requestedHeight
    );

    // ==================================================
    // FIND VIDEO FORMAT
    // ==================================================

    let videoFormats =
        info.formats.filter(
            format =>
                format.hasVideo &&
                !format.hasAudio &&
                format.container === "mp4" &&
                format.height
        );

    // --------------------------------------------------
    // First try requested quality or lower
    // --------------------------------------------------

    let possibleVideoFormats =
        videoFormats.filter(
            format =>
                format.height <=
                requestedHeight
        );

    // --------------------------------------------------
    // If no lower format exists,
    // use the lowest available MP4 video
    // --------------------------------------------------

    if (
        !possibleVideoFormats.length
    ) {

        possibleVideoFormats =
            videoFormats;
    }

    if (
        !possibleVideoFormats.length
    ) {

        throw new Error(
            `No MP4 video stream available for ${quality}.`
        );
    }

    // ==================================================
    // SORT VIDEO
    // ==================================================

    possibleVideoFormats.sort(
        (a, b) => {

            if (
                b.height !==
                a.height
            ) {

                return (
                    b.height -
                    a.height
                );
            }

            return (
                (b.bitrate || 0) -
                (a.bitrate || 0)
            );
        }
    );

    const videoFormat =
        possibleVideoFormats[0];

    console.log(
        "Selected video:",
        videoFormat.height +
        "p",
        videoFormat.container
    );

    // ==================================================
    // FIND AUDIO
    // ==================================================

    let audioFormats =
        info.formats.filter(
            format =>
                format.hasAudio &&
                !format.hasVideo
        );

    if (
        !audioFormats.length
    ) {

        throw new Error(
            "No audio stream available."
        );
    }

    // Prefer m4a because final file is MP4
    const m4aFormats =
        audioFormats.filter(
            format =>
                format.container ===
                "mp4"
        );

    if (
        m4aFormats.length
    ) {

        audioFormats =
            m4aFormats;
    }

    // ==================================================
    // SORT AUDIO
    // ==================================================

    audioFormats.sort(
        (a, b) =>
            (b.audioBitrate || 0) -
            (a.audioBitrate || 0)
    );

    const audioFormat =
        audioFormats[0];

    console.log(
        "Selected audio:",
        audioFormat.container,
        audioFormat.audioBitrate
    );

    // ==================================================
    // TEMP FILES
    // ==================================================

    const tempVideo =
        outputPath.replace(
            ".mp4",
            "_video.mp4"
        );

    const tempAudio =
        outputPath.replace(
            ".mp4",
            "_audio.m4a"
        );

    // ==================================================
    // DOWNLOAD VIDEO
    // ==================================================

    console.log(
        "Downloading video stream..."
    );

    await downloadStream(
        videoFormat.url,
        tempVideo
    );

    console.log(
        "Video stream downloaded."
    );

    // ==================================================
    // DOWNLOAD AUDIO
    // ==================================================

    console.log(
        "Downloading audio stream..."
    );

    await downloadStream(
        audioFormat.url,
        tempAudio
    );

    console.log(
        "Audio stream downloaded."
    );

    // ==================================================
    // MERGE
    // ==================================================

    console.log(
        "Merging video + audio..."
    );

    await mergeVideoAudio(
        tempVideo,
        tempAudio,
        outputPath
    );

    // ==================================================
    // CLEAN TEMP
    // ==================================================

    try {

        if (
            fs.existsSync(tempVideo)
        ) {
            fs.unlinkSync(
                tempVideo
            );
        }

        if (
            fs.existsSync(tempAudio)
        ) {
            fs.unlinkSync(
                tempAudio
            );
        }

    } catch (e) {

        console.log(
            "Temp cleanup:",
            e.message
        );
    }

    // ==================================================
    // VALIDATE
    // ==================================================

    if (
        !fs.existsSync(outputPath)
    ) {

        throw new Error(
            "Final video was not created."
        );
    }

    const size =
        fs.statSync(
            outputPath
        ).size;

    if (
        size < 1000
    ) {

        throw new Error(
            "Final video file is invalid."
        );
    }

    console.log(
        "Final video size:",
        size
    );

    return outputPath;
}

// ======================================================
// DOWNLOAD HTTP STREAM
// ======================================================

function downloadStream(
    url,
    outputPath
) {

    return new Promise(
        async (resolve, reject) => {

            try {

                const response =
                    await axios.get(
                        url,
                        {
                            responseType:
                                "stream",

                            timeout:
                                0,

                            maxContentLength:
                                Infinity,

                            maxBodyLength:
                                Infinity,

                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0"
                            }
                        }
                    );

                const writer =
                    fs.createWriteStream(
                        outputPath
                    );

                response.data.pipe(
                    writer
                );

                response.data.on(
                    "error",
                    reject
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

            } catch (error) {

                reject(error);
            }
        }
    );
}

// ======================================================
// MERGE VIDEO + AUDIO
// ======================================================

function mergeVideoAudio(
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

                    "-c:v copy",

                    "-c:a aac",

                    "-b:a 128k",

                    "-movflags +faststart",

                    "-shortest"

                ])

                .output(outputPath)

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
                    "progress",
                    progress => {

                        if (
                            progress.percent
                        ) {

                            console.log(
                                `Merge: ${progress.percent.toFixed(1)}%`
                            );
                        }
                    }
                )

                .on(
                    "end",
                    () => {

                        console.log(
                            "Merge completed."
                        );

                        resolve(
                            outputPath
                        );
                    }
                )

                .on(
                    "error",
                    error => {

                        console.error(
                            "FFmpeg Error:",
                            error
                        );

                        reject(error);
                    }
                )

                .run();
        }
    );
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
        // 2. VIDEO SEARCH / URL
        // ==================================================

        let data;
        let ytUrl;

        if (
            isYouTubeUrl(query)
        ) {

            const id =
                getYouTubeId(query);

            if (!id) {

                return reply(
                    "❌ Invalid YouTube link."
                );
            }

            ytUrl =
                normalizeYouTubeUrl(
                    query
                );

            try {

                const result =
                    await yts({
                        videoId: id
                    });

                if (
                    result?.videoId
                ) {

                    data =
                        result;

                } else if (
                    result?.videos?.length
                ) {

                    data =
                        result.videos[0];

                }

            } catch (error) {

                console.log(
                    "Metadata error:",
                    error.message
                );
            }

            // Fallback metadata
            if (!data) {

                try {

                    const search =
                        await yts(id);

                    if (
                        search?.videos?.length
                    ) {

                        data =
                            search.videos[0];
                    }

                } catch (e) {

                    console.log(
                        "Fallback search:",
                        e.message
                    );
                }
            }

            if (!data) {

                return reply(
                    "❌ Unable to get video information."
                );
            }

        } else {

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
                normalizeYouTubeUrl(
                    data.url
                );
        }

        // ==================================================
        // 3. TEMPLATE
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
        // 4. SEND MENU
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

                    senderID =
                        receivedMsg
                            .key
                            .remoteJid;

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
                    // UNIQUE FILE
                    // ==================================================

                    const uniqueID =
                        `${Date.now()}_${Math.random()
                            .toString(36)
                            .substring(2, 8)}`;

                    const finalOutput =
                        path.join(
                            tempDir,
                            `${uniqueID}_final.mp4`
                        );

                    try {

                        // ==================================================
                        // DIRECT YOUTUBE DOWNLOAD
                        // ==================================================

                        console.log(
                            "Downloading:",
                            ytUrl
                        );

                        await downloadYouTubeVideo(
                            ytUrl,
                            selectedFormat,
                            finalOutput
                        );

                        // ==================================================
                        // VALIDATE
                        // ==================================================

                        if (
                            !fs.existsSync(
                                finalOutput
                            )
                        ) {

                            throw new Error(
                                "Final video does not exist."
                            );
                        }

                        const fileSize =
                            fs.statSync(
                                finalOutput
                            ).size;

                        console.log(
                            "Final file:",
                            fileSize,
                            "bytes"
                        );

                        if (
                            fileSize <
                            1000
                        ) {

                            throw new Error(
                                "Video file is invalid."
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
                        // SAFE TITLE
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
                                            finalOutput
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
                                            finalOutput
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
