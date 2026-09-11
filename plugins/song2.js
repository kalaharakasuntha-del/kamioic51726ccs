const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// =====================================================
// Fake ChatGPT vCard
// =====================================================

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
// Extract YouTube Video ID
// =====================================================

function getYouTubeVideoId(url) {

    if (!url) return null;

    const patterns = [

        // Shorts
        /youtube\.com\/shorts\/([^?&#/]+)/i,

        // Watch
        /youtube\.com\/watch\?[^#]*v=([^&#]+)/i,

        // youtu.be
        /youtu\.be\/([^?&#/]+)/i,

        // YouTube embed
        /youtube\.com\/embed\/([^?&#/]+)/i,

        // YouTube live
        /youtube\.com\/live\/([^?&#/]+)/i
    ];

    for (const pattern of patterns) {

        const match = url.match(pattern);

        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// =====================================================
// YouTube URL Check
// =====================================================

function isYouTubeUrl(text) {

    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i
        .test(text);
}

// =====================================================
// Clean File Name
// =====================================================

function cleanFileName(name) {

    return String(name || "song")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150) || "song";
}

// =====================================================
// SONG COMMAND
// =====================================================

cmd({
    pattern: "song",
    alias: ["play", "song1"],
    desc: "YouTube Song Downloader",
    category: "download",
    filename: __filename,

}, async (conn, m, store, { from, quoted, q, reply }) => {

    try {

        // =================================================
        // GET QUERY
        // =================================================

        let query = q?.trim();

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

        // =================================================
        // VARIABLES
        // =================================================

        let video;
        let videoId = null;
        let youtubeUrl = null;

        // =================================================
        // DIRECT YOUTUBE URL
        // =================================================

        if (isYouTubeUrl(query)) {

            videoId = getYouTubeVideoId(query);

            if (!videoId) {

                return reply(
                    "❌ Invalid YouTube URL."
                );
            }

            // ---------------------------------------------
            // IMPORTANT:
            // Shorts → normal watch URL
            // ---------------------------------------------

            youtubeUrl =
                `https://www.youtube.com/watch?v=${videoId}`;

            console.log(
                "YouTube Video ID:",
                videoId
            );

            console.log(
                "YouTube URL:",
                youtubeUrl
            );

            // ---------------------------------------------
            // Try to get metadata
            // BUT DON'T FAIL if yt-search fails
            // ---------------------------------------------

            try {

                const result = await yts({
                    videoId: videoId
                });

                if (
                    result &&
                    result.title
                ) {

                    video = result;

                    console.log(
                        "yt-search metadata found"
                    );
                }

            } catch (err) {

                console.log(
                    "yt-search metadata failed:",
                    err.message
                );

            }

            // ---------------------------------------------
            // If metadata failed, create basic object
            // ---------------------------------------------

            if (!video) {

                video = {

                    title:
                        `YouTube Video ${videoId}`,

                    url:
                        youtubeUrl,

                    thumbnail:
                        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,

                    timestamp:
                        "Unknown",

                    ago:
                        "Unknown",

                    views:
                        "Unknown"
                };

                console.log(
                    "Using fallback YouTube metadata"
                );
            }

            // ---------------------------------------------
            // ALWAYS force correct URL
            // ---------------------------------------------

            video.url = youtubeUrl;

        }

        // =================================================
        // SONG NAME SEARCH
        // =================================================

        else {

            console.log(
                "Searching YouTube:",
                query
            );

            const search =
                await yts(query);

            if (
                !search ||
                !search.videos ||
                !search.videos.length
            ) {

                return reply(
                    "❌ Song not found."
                );
            }

            video =
                search.videos[0];

            youtubeUrl =
                video.url;
        }

        // =================================================
        // CHECK URL
        // =================================================

        if (!youtubeUrl) {

            return reply(
                "❌ Unable to get YouTube URL."
            );
        }

        console.log(
            "Final YouTube URL:",
            youtubeUrl
        );

        // =================================================
        // DARK-KNIGHT API
        // =================================================

        const api =
            "https://dark-knight-yt-dl-api.vercel.app/download/ytmp3?url=" +
            encodeURIComponent(youtubeUrl);

        console.log(
            "Dark-Knight API:",
            api
        );

        let data;

        try {

            const response =
                await axios.get(api, {
                    timeout: 60000
                });

            data =
                response.data;

        } catch (apiError) {

            console.error(
                "Download API Error:",
                apiError.message
            );

            return reply(
                "❌ Download API is not responding.\n\nPlease try again later."
            );
        }

        console.log(
            "API Status:",
            data?.status
        );

        // =================================================
        // CHECK API RESPONSE
        // =================================================

        if (
            !data?.status ||
            !data?.download?.status ||
            !data?.download?.url
        ) {

            console.log(
                "Dark-Knight API Response:",
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );

            return reply(
                "❌ Unable to download this YouTube video.\n\nThe video may not be supported by the download API."
            );
        }

        // =================================================
        // DOWNLOAD DATA
        // =================================================

        const songUrl =
            data.download.url;

        const title =
            data.metadata?.title ||
            video.title ||
            "Unknown Song";

        const thumbnail =
            data.metadata?.thumbnail ||
            data.metadata?.image ||
            video.thumbnail ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        const duration =
            data.metadata?.duration?.timestamp ||
            data.metadata?.timestamp ||
            video.timestamp ||
            video.duration?.timestamp ||
            "Unknown";

        const quality =
            data.download?.quality ||
            "128kbps";

        const filename =
            data.download?.filename ||
            `${cleanFileName(title)}.mp3`;

        // =================================================
        // MENU
        // =================================================

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

🔗 *YouTube:*
${youtubeUrl}

━━━━━━━━━━━━━━━━━━

🔽 *Reply with your choice:*

1️⃣ Audio Type 🎵

2️⃣ Document Type 📁

3️⃣ Voice Note Type 🎤

━━━━━━━━━━━━━━━━━━

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝐃 🌛
`
                },
                {
                    quoted: fakevCard
                }
            );

        const messageID =
            sentMsg.key.id;

        // =================================================
        // REPLY LISTENER
        // =================================================

        const handler = async (msgData) => {

            try {

                const receivedMsg =
                    msgData.messages?.[0];

                if (!receivedMsg?.message)
                    return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text ||
                    "";

                const senderID =
                    receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage?.contextInfo;

                // -----------------------------------------
                // Check reply to our menu
                // -----------------------------------------

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                if (!isReplyToBot)
                    return;

                const option =
                    receivedText.trim();

                // =================================================
                // OPTION 1 - AUDIO
                // =================================================

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

                            mimetype:
                                "audio/mpeg",

                            fileName:
                                filename

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

                // =================================================
                // OPTION 2 - DOCUMENT
                // =================================================

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
                        cleanFileName(title);

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

                // =================================================
                // OPTION 3 - VOICE NOTE
                // =================================================

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

                        // -----------------------------------------
                        // Download MP3
                        // -----------------------------------------

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

                        // -----------------------------------------
                        // MP3 → OPUS
                        // -----------------------------------------

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

                        // -----------------------------------------
                        // Send Voice Note
                        // -----------------------------------------

                        await conn.sendMessage(
                            senderID,
                            {
                                audio:
                                    fs.readFileSync(
                                        opusPath
                                    ),

                                mimetype:
                                    "audio/ogg; codecs=opus",

                                ptt:
                                    true

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

                        // -----------------------------------------
                        // Delete temp files
                        // -----------------------------------------

                        try {

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

                        } catch (cleanupError) {

                            console.log(
                                "Cleanup error:",
                                cleanupError.message
                            );
                        }
                    }
                }

                // =================================================
                // INVALID OPTION
                // =================================================

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
                        msgData.messages?.[0]?.key?.remoteJid,
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

        // =================================================
        // LISTEN FOR REPLY
        // =================================================

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
