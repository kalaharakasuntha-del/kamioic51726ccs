const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

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

// =====================================================
// FORMAT DURATION
// =====================================================

function formatDuration(value) {

    if (value === undefined || value === null)
        return null;

    if (typeof value === "object") {

        if (value.timestamp)
            return value.timestamp;

        if (value.seconds !== undefined)
            value = value.seconds;
    }

    if (typeof value === "string") {

        if (
            value.includes(":") &&
            !value.toLowerCase().includes("unknown")
        ) {
            return value;
        }

        if (/^\d+$/.test(value)) {
            value = Number(value);
        }
    }

    if (typeof value === "number" && isFinite(value)) {

        const totalSeconds = Math.floor(value);

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

        const seconds =
            totalSeconds % 60;

        if (hours > 0) {

            return (
                `${hours}:` +
                `${String(minutes).padStart(2, "0")}:` +
                `${String(seconds).padStart(2, "0")}`
            );

        }

        return (
            `${minutes}:` +
            `${String(seconds).padStart(2, "0")}`
        );
    }

    return null;
}

// =====================================================
// GET VIDEO DURATION
// =====================================================

function getVideoDuration(video, metadata) {

    const values = [

        metadata?.duration?.timestamp,

        metadata?.duration,

        metadata?.timestamp,

        video?.duration?.timestamp,

        video?.duration?.seconds,

        video?.timestamp,

        video?.seconds

    ];

    for (const value of values) {

        const result =
            formatDuration(value);

        if (result)
            return result;
    }

    return "Unknown";
}

cmd({
    pattern: "song",
    alias: ["play", "song1"],
    desc: "YouTube Song Downloader",
    category: "download",
    filename: __filename,
}, async (conn, m, store, { from, quoted, q, reply }) => {

    try {

        /* =====================================================
                           GET QUERY
        ===================================================== */

        let query = q?.trim();

        // If no query, check quoted message
        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }

        if (!query) {
            return reply(
                "⚠️ Please provide a song name or YouTube link."
            );
        }

        await conn.sendMessage(from, {
            react: {
                text: "🎵",
                key: m.key
            }
        });

        /* =====================================================
                    YOUTUBE URL DETECTION
        ===================================================== */

        const isYouTubeUrl =
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i
                .test(query);

        let video;

        /* =====================================================
                    DIRECT YOUTUBE URL
                    + SHORTS SUPPORT
        ===================================================== */

        if (isYouTubeUrl) {

            let videoId = null;

            /*
             * YouTube Shorts
             *
             * https://youtube.com/shorts/VIDEO_ID
             */

            const shortsMatch = query.match(
                /youtube\.com\/shorts\/([^?&#/]+)/i
            );

            /*
             * Normal YouTube
             *
             * https://youtube.com/watch?v=VIDEO_ID
             */

            const watchMatch = query.match(
                /youtube\.com\/watch\?[^#]*v=([^&#]+)/i
            );

            /*
             * Short URL
             *
             * https://youtu.be/VIDEO_ID
             */

            const youtuBeMatch = query.match(
                /youtu\.be\/([^?&#/]+)/i
            );

            if (shortsMatch) {

                videoId = shortsMatch[1];

            } else if (watchMatch) {

                videoId = watchMatch[1];

            } else if (youtuBeMatch) {

                videoId = youtuBeMatch[1];

            }

            if (!videoId) {
                return reply(
                    "❌ Invalid YouTube URL."
                );
            }

            /*
             * Convert Shorts URL to normal YouTube URL
             */

            const youtubeUrl =
                `https://www.youtube.com/watch?v=${videoId}`;

            /*
             * Get exact video information
             *
             * IMPORTANT:
             * Use videoId lookup first.
             * This gives duration.timestamp.
             */

            try {

                const result =
                    await yts({
                        videoId: videoId
                    });

                if (
                    result &&
                    result.title
                ) {

                    video = result;

                }

            } catch (err) {

                console.log(
                    "YouTube video info error:",
                    err.message
                );
            }

            /*
             * Fallback
             */

            if (!video) {

                try {

                    const search =
                        await yts(youtubeUrl);

                    if (
                        search?.videos?.length
                    ) {

                        video =
                            search.videos[0];

                    }

                } catch (err) {

                    console.log(
                        "YouTube fallback error:",
                        err.message
                    );
                }
            }

            /*
             * If yt-search cannot get metadata,
             * still continue to download API
             */

            if (!video) {

                video = {

                    url: youtubeUrl,

                    title:
                        "YouTube Video",

                    thumbnail:
                        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,

                    timestamp:
                        "Unknown",

                    ago:
                        "Unknown",

                    views:
                        "Unknown",

                    duration: {
                        timestamp:
                            "Unknown"
                    }

                };

            }

            /*
             * Make sure API receives normal URL
             */

            video.url =
                youtubeUrl;

        }

        /* =====================================================
                         SONG NAME SEARCH
        ===================================================== */

        else {

            const search =
                await yts(query);

            if (!search?.videos?.length) {
                return reply(
                    "❌ Song not found."
                );
            }

            video =
                search.videos[0];
        }

        /* =====================================================
                        DARK-KNIGHT API
        ===================================================== */

        const api =
            "https://dark-knight-yt-dl-api.vercel.app/download/ytmp3?url=" +
            encodeURIComponent(video.url);

        console.log(
            "Dark-Knight API:",
            api
        );

        const { data } =
            await axios.get(api, {
                timeout: 60000
            });

        console.log(
            "API Status:",
            data?.status
        );

        if (
            !data?.status ||
            !data?.download?.status ||
            !data?.download?.url
        ) {

            console.log(
                "Dark-Knight API Response:",
                data
            );

            return reply(
                "❌ Download API failed.\n\nPlease try another video."
            );
        }

        /* =====================================================
                         DOWNLOAD DATA
        ===================================================== */

        const songUrl =
            data.download.url;

        const title =
            data.metadata?.title ||
            video.title ||
            "Unknown Song";

        const thumbnail =
            data.metadata?.thumbnail ||
            data.metadata?.image ||
            video.thumbnail;

        /*
         * FIX:
         * Get duration from API first.
         * If API doesn't provide it,
         * get it from yt-search.
         */

        const duration =
            getVideoDuration(
                video,
                data.metadata
            );

        const quality =
            data.download?.quality ||
            "128kbps";

        const filename =
            data.download?.filename ||
            `${title}.mp3`;

        /* =====================================================
                            MENU
        ===================================================== */

        const sentMsg =
            await conn.sendMessage(
                from,
                {
                    image: {
                        url: thumbnail
                    },

                    caption: `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${title}
⏱ *Duration:* ${duration}
🎧 *Quality:* ${quality}
📆 *Uploaded:* ${video.ago || "Unknown"}
👁 *Views:* ${video.views || "Unknown"}
🔗 *Url:*
${video.url}

🔽 *Reply with your choice:*

1️⃣ Audio Type 🎵
2️⃣ Document Type 📁
3️⃣ Voice Note Type 🎤

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝐃 🌛
`
                },
                {
                    quoted: fakevCard
                }
            );

        const messageID =
            sentMsg.key.id;

        /* =====================================================
                         REPLY LISTENER
        ===================================================== */

        const handler = async (msgData) => {

            try {

                const receivedMsg =
                    msgData.messages?.[0];

                if (!receivedMsg?.message)
                    return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage
                        ?.text ||
                    "";

                const senderID =
                    receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage
                        ?.contextInfo;

                /*
                 * Check whether user replied
                 * to our menu message
                 */

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                if (!isReplyToBot)
                    return;

                await conn.sendMessage(
                    senderID,
                    {
                        react: {
                            text: "⬇️",
                            key: receivedMsg.key
                        }
                    }
                );

                const option =
                    receivedText.trim();

                /* =================================================
                              OPTION 1
                              AUDIO
                ================================================= */

                if (option === "1") {

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬆️",
                                key: receivedMsg.key
                            }
                        }
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            audio: {
                                url: songUrl
                            },

                            mimetype: "audio/mpeg",

                            fileName: filename
                        },
                        {
                            quoted: receivedMsg
                        }
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "✔️",
                                key: receivedMsg.key
                            }
                        }
                    );
                }

                /* =================================================
                              OPTION 2
                              DOCUMENT
                ================================================= */

                else if (option === "2") {

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬆️",
                                key: receivedMsg.key
                            }
                        }
                    );

                    const response =
                        await axios.get(
                            songUrl,
                            {
                                responseType:
                                    "arraybuffer",

                                timeout:
                                    120000
                            }
                        );

                    const cleanName =
                        title
                            .replace(
                                /[\\/:*?"<>|]/g,
                                ""
                            )
                            .trim() ||
                        "song";

                    await conn.sendMessage(
                        senderID,
                        {
                            document:
                                Buffer.from(
                                    response.data
                                ),

                            mimetype:
                                "audio/mpeg",

                            fileName:
                                `${cleanName}.mp3`
                        },
                        {
                            quoted:
                                receivedMsg
                        }
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "✔️",
                                key: receivedMsg.key
                            }
                        }
                    );
                }

                /* =================================================
                              OPTION 3
                              VOICE NOTE
                ================================================= */

                else if (option === "3") {

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬆️",
                                key: receivedMsg.key
                            }
                        }
                    );

                    const timestamp =
                        Date.now();

                    const mp3Path =
                        path.join(
                            __dirname,
                            `${timestamp}.mp3`
                        );

                    const opusPath =
                        path.join(
                            __dirname,
                            `${timestamp}.opus`
                        );

                    try {

                        /* =========================================
                              DOWNLOAD MP3
                        ========================================= */

                        const response =
                            await axios.get(
                                songUrl,
                                {
                                    responseType:
                                        "stream",

                                    timeout:
                                        120000
                                }
                            );

                        const writer =
                            fs.createWriteStream(
                                mp3Path
                            );

                        response.data.pipe(
                            writer
                        );

                        await new Promise(
                            (resolve, reject) => {

                                writer.on(
                                    "finish",
                                    resolve
                                );

                                writer.on(
                                    "error",
                                    reject
                                );
                            }
                        );

                        /* =========================================
                              MP3 → OPUS
                        ========================================= */

                        await new Promise(
                            (resolve, reject) => {

                                ffmpeg(mp3Path)

                                    .audioCodec(
                                        "libopus"
                                    )

                                    .audioChannels(
                                        1
                                    )

                                    .audioFrequency(
                                        48000
                                    )

                                    .format(
                                        "opus"
                                    )

                                    .on(
                                        "end",
                                        resolve
                                    )

                                    .on(
                                        "error",
                                        reject
                                    )

                                    .save(
                                        opusPath
                                    );
                            }
                        );

                        /* =========================================
                              SEND VOICE NOTE
                        ========================================= */

                        await conn.sendMessage(
                            senderID,
                            {
                                audio:
                                    fs.readFileSync(
                                        opusPath
                                    ),

                                mimetype:
                                    "audio/ogg; codecs=opus",

                                ptt: true
                            },
                            {
                                quoted:
                                    receivedMsg
                            }
                        );

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

                        /* =========================================
                              CLEAN TEMP FILES
                        ========================================= */

                        if (
                            fs.existsSync(
                                mp3Path
                            )
                        ) {
                            fs.unlinkSync(
                                mp3Path
                            );
                        }

                        if (
                            fs.existsSync(
                                opusPath
                            )
                        ) {
                            fs.unlinkSync(
                                opusPath
                            );
                        }
                    }
                }

                /* =================================================
                              INVALID OPTION
                ================================================= */

                else {

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "😒",
                                key:
                                    receivedMsg.key
                            }
                        }
                    );

                    await conn.sendMessage(
                        senderID,
                        {
                            text:
                                "❌ *Invalid option!*\n\nReply with *1*, *2*, or *3*."
                        },
                        {
                            quoted:
                                receivedMsg
                        }
                    );
                }

            } catch (error) {

                console.error(
                    "Song Reply Handler Error:",
                    error
                );

                try {

                    await conn.sendMessage(
                        msgData.messages?.[0]
                            ?.key?.remoteJid,
                        {
                            text:
                                "❌ *Download failed!*\nPlease try again."
                        }
                    );

                } catch (e) {

                    console.error(
                        "Error sending failure message:",
                        e
                    );
                }
            }
        };

        /*
         * Listen for reply
         */

        conn.ev.on(
            "messages.upsert",
            handler
        );

    } catch (error) {

        console.error(
            "RANUMITHA Song Plugin Error:",
            error
        );

        return reply(
            "❌ *Error downloading or sending audio.*"
        );
    }
});
