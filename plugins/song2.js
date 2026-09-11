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

        /*
         * Supports:
         * .song song name
         * .song youtube link
         * Reply to YouTube link with .song
         */

        if (!query && quoted) {

            query =
                quoted.text ||
                quoted.message?.conversation ||
                quoted.message?.extendedTextMessage?.text ||
                quoted.message?.imageMessage?.caption ||
                quoted.message?.videoMessage?.caption ||
                "";
        }

        query = query?.trim();

        if (!query) {
            return reply(
                "⚠️ Please provide a song name or YouTube link.\n\n" +
                "Example:\n" +
                ".song Alan Walker Faded\n\n" +
                "Or reply to a YouTube / Shorts link with:\n" +
                ".song"
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

        const youtubeRegex =
            /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

        const isYouTubeUrl =
            youtubeRegex.test(query);

        let video;

        /* =====================================================
                     DIRECT YOUTUBE / SHORTS URL
        ===================================================== */

        if (isYouTubeUrl) {

            let videoId = null;

            /*
             * YouTube Shorts
             *
             * https://youtube.com/shorts/VIDEO_ID
             */

            const shortsMatch =
                query.match(
                    /youtube\.com\/shorts\/([^?&#\s/]+)/i
                );

            /*
             * Normal YouTube
             *
             * https://youtube.com/watch?v=VIDEO_ID
             */

            const watchMatch =
                query.match(
                    /youtube\.com\/watch\?[^#\s]*v=([^&#\s]+)/i
                );

            /*
             * youtu.be
             */

            const youtuBeMatch =
                query.match(
                    /youtu\.be\/([^?&#\s/]+)/i
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
                    "❌ Invalid YouTube / Shorts URL."
                );
            }

            /*
             * Convert everything to normal YouTube URL
             */

            const youtubeUrl =
                `https://www.youtube.com/watch?v=${videoId}`;

            /* =================================================
                         GET VIDEO INFORMATION
            ================================================= */

            try {

                video =
                    await yts({
                        videoId: videoId
                    });

            } catch (err) {

                console.log(
                    "yt-search video error:",
                    err.message
                );
            }

            /*
             * Fallback
             */

            if (!video) {

                try {

                    const result =
                        await yts(youtubeUrl);

                    if (
                        result?.videos?.length
                    ) {
                        video =
                            result.videos[0];
                    }

                } catch (err) {

                    console.log(
                        "yt-search fallback error:",
                        err.message
                    );
                }
            }

            if (!video) {
                return reply(
                    "❌ Could not get YouTube video information."
                );
            }

            /*
             * IMPORTANT:
             * API receives normal YouTube URL
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
        }

        /* =====================================================
                         DARK-KNIGHT API
        ===================================================== */

        const api =
            "https://dark-knight-yt-dl-api.vercel.app/download/ytmp3?url=" +
            encodeURIComponent(video.url);

        console.log(
            "Song API:",
            api
        );

        const { data } =
            await axios.get(api, {
                timeout: 60000
            });

        if (
            !data?.status ||
            !data?.download?.status ||
            !data?.download?.url
        ) {

            console.log(
                "API Response:",
                data
            );

            return reply(
                "❌ Download failed.\n\n" +
                "The API could not process this YouTube video."
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

        const duration =
            data.metadata?.duration?.timestamp ||
            data.metadata?.timestamp ||
            video.timestamp ||
            "Unknown";

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

        const handler =
            async (msgData) => {

                try {

                    const receivedMsg =
                        msgData.messages?.[0];

                    if (
                        !receivedMsg?.message
                    ) {
                        return;
                    }

                    const receivedText =
                        receivedMsg.message
                            .conversation ||
                        receivedMsg.message
                            .extendedTextMessage
                            ?.text ||
                        "";

                    const senderID =
                        receivedMsg.key.remoteJid;

                    const contextInfo =
                        receivedMsg.message
                            .extendedTextMessage
                            ?.contextInfo;

                    const isReplyToBot =
                        contextInfo?.stanzaId ===
                        messageID;

                    if (!isReplyToBot) {
                        return;
                    }

                    const option =
                        receivedText.trim();

                    await conn.sendMessage(
                        senderID,
                        {
                            react: {
                                text: "⬇️",
                                key: receivedMsg.key
                            }
                        }
                    );

                    /* =================================================
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

                    /* =================================================
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

                            /* Download MP3 */

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

                            /* MP3 → OPUS */

                            await new Promise(
                                (resolve, reject) => {

                                    ffmpeg(
                                        mp3Path
                                    )
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

                            /* Send Voice */

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
                                    "❌ *Invalid option!*\n\n" +
                                    "Reply with *1*, *2*, or *3*."
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
                                    "❌ *Download failed!*\n" +
                                    "Please try again."
                            }
                        );

                    } catch (e) {
                        console.error(e);
                    }
                }
            };

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
