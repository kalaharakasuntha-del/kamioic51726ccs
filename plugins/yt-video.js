const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

// ======================================================
// FFMPEG
// ======================================================

ffmpeg.setFfmpegPath(ffmpegPath);

// ======================================================
// FAKE CHATGPT VCARD
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
N:Mr Hiruka;;;;
FN:Mr Hiruka
TEL;type=CELL;type=VOICE;waid=0:+0
END:VCARD`
        }
    }
};

// ======================================================
// ACTIVE VIDEO SESSIONS
// Unlimited replies
// ======================================================

const connectionSessions = new WeakMap();
const connectionListeners = new WeakSet();

function getSessions(conn) {
    let sessions = connectionSessions.get(conn);

    if (!sessions) {
        sessions = new Map();
        connectionSessions.set(conn, sessions);
    }

    return sessions;
}

// ======================================================
// CREATE LISTENER ONLY ONCE PER CONNECTION
// ======================================================

function ensureReplyListener(conn) {

    if (connectionListeners.has(conn)) {
        return;
    }

    connectionListeners.add(conn);

    const sessions = getSessions(conn);

    conn.ev.on("messages.upsert", async ({ messages }) => {

        for (const msg of messages) {

            try {

                if (!msg || !msg.message) continue;

                const context =
                    msg.message?.extendedTextMessage?.contextInfo;

                if (!context) continue;

                const repliedMessageId = context.stanzaId;

                if (!repliedMessageId) continue;

                const session = sessions.get(repliedMessageId);

                if (!session) continue;

                // Same chat only
                if (msg.key.remoteJid !== session.from) {
                    continue;
                }

                const userReply =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    "";

                const choice = userReply.trim();

                const qualityMap = {
                    "1.1": "144p",
                    "1.2": "360p",
                    "1.3": "480p",
                    "1.4": "720p",
                    "1.5": "1080p",

                    "2.1": "144p",
                    "2.2": "360p",
                    "2.3": "480p",
                    "2.4": "720p",
                    "2.5": "1080p"
                };

                if (!qualityMap[choice]) {
                    continue;
                }

                const quality = qualityMap[choice];

                const isDocument = choice.startsWith("2.");

                // ==================================================
                // TEMP DIRECTORY
                // ==================================================

                const tempDir = path.join(
                    os.tmpdir(),
                    "ranumitha-video"
                );

                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, {
                        recursive: true
                    });
                }

                const randomId =
                    `${Date.now()}_${Math.random()
                        .toString(36)
                        .substring(2, 8)}`;

                const inputFile = path.join(
                    tempDir,
                    `${randomId}_input`
                );

                const outputFile = path.join(
                    tempDir,
                    `${randomId}_${quality}.mp4`
                );

                try {

                    // ==================================================
                    // DOWNLOADING MESSAGE
                    // ==================================================

                    await conn.sendMessage(
                        session.from,
                        {
                            text:
                                `⏳ *Downloading ${quality}...*\n\n` +
                                `📽️ Please wait...`
                        },
                        {
                            quoted: msg
                        }
                    );

                    // ==================================================
                    // API REQUEST
                    // ==================================================

                    const apiUrl =
                        `https://api-ytdlwsmd-mini.vercel.app/api/download` +
                        `?url=${encodeURIComponent(session.url)}` +
                        `&quality=${encodeURIComponent(quality)}` +
                        `&mode=separate`;

                    const apiResponse = await axios.get(apiUrl, {
                        timeout: 120000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    });

                    const apiData = apiResponse.data;

                    if (
                        !apiData ||
                        apiData.status !== true ||
                        !apiData.result ||
                        !apiData.result.video
                    ) {
                        throw new Error(
                            "Invalid API response"
                        );
                    }

                    const videoUrl = apiData.result.video;

                    // ==================================================
                    // DOWNLOAD VIDEO STREAM
                    // ==================================================

                    const videoResponse = await axios.get(
                        videoUrl,
                        {
                            responseType: "stream",
                            timeout: 180000,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0"
                            }
                        }
                    );

                    await new Promise((resolve, reject) => {

                        const writer =
                            fs.createWriteStream(inputFile);

                        videoResponse.data.pipe(writer);

                        writer.on("finish", resolve);
                        writer.on("error", reject);

                        videoResponse.data.on(
                            "error",
                            reject
                        );
                    });

                    // ==================================================
                    // CONVERT TO WHATSAPP COMPATIBLE MP4
                    // H.264 + AAC + yuv420p
                    // ==================================================

                    await new Promise((resolve, reject) => {

                        ffmpeg(inputFile)
                            .videoCodec("libx264")
                            .audioCodec("aac")
                            .outputOptions([
                                "-map 0:v:0",
                                "-map 0:a:0?",
                                "-pix_fmt yuv420p",
                                "-preset veryfast",
                                "-crf 23",
                                "-movflags +faststart",
                                "-profile:v main",
                                "-level 3.1",
                                "-ar 44100",
                                "-ac 2",
                                "-b:a 128k"
                            ])
                            .format("mp4")
                            .on("start", commandLine => {
                                console.log(
                                    "[FFMPEG]",
                                    commandLine
                                );
                            })
                            .on("progress", progress => {
                                if (progress.percent) {
                                    console.log(
                                        `Converting ${quality}: ` +
                                        `${Math.floor(progress.percent)}%`
                                    );
                                }
                            })
                            .on("error", error => {
                                console.error(
                                    "[FFMPEG ERROR]",
                                    error
                                );

                                reject(error);
                            })
                            .on("end", resolve)
                            .save(outputFile);

                    });

                    // ==================================================
                    // CHECK OUTPUT
                    // ==================================================

                    if (
                        !fs.existsSync(outputFile) ||
                        fs.statSync(outputFile).size === 0
                    ) {
                        throw new Error(
                            "MP4 conversion failed"
                        );
                    }

                    // ==================================================
                    // SEND VIDEO / DOCUMENT
                    // ==================================================

                    if (isDocument) {

                        await conn.sendMessage(
                            session.from,
                            {
                                document: {
                                    stream:
                                        fs.createReadStream(
                                            outputFile
                                        )
                                },
                                mimetype:
                                    "video/mp4",
                                fileName:
                                    `${session.title || "Ranumitha"}_${quality}.mp4`,
                                caption:
                                    `📂 *${quality} Video Document*\n\n` +
                                    `🎬 ${session.title || "YouTube Video"}`
                            },
                            {
                                quoted: fakevCard
                            }
                        );

                    } else {

                        await conn.sendMessage(
                            session.from,
                            {
                                video: {
                                    stream:
                                        fs.createReadStream(
                                            outputFile
                                        )
                                },
                                mimetype:
                                    "video/mp4",
                                fileName:
                                    `${session.title || "Ranumitha"}_${quality}.mp4`,
                                caption:
                                    `📽️ *${quality} Video*\n\n` +
                                    `🎬 ${session.title || "YouTube Video"}`,
                                ptt: false
                            },
                            {
                                quoted: fakevCard
                            }
                        );
                    }

                    // ==================================================
                    // SUCCESS
                    // ==================================================

                    console.log(
                        `✅ ${quality} sent successfully`
                    );

                } catch (error) {

                    console.error(
                        "[VIDEO ERROR]",
                        error
                    );

                    let errorText =
                        "❌ *Download failed!*\n\n";

                    if (error.response) {
                        errorText +=
                            `Quality: ${quality}\n` +
                            `HTTP Status: ${error.response.status}\n\n`;
                    } else {
                        errorText +=
                            `Quality: ${quality}\n\n`;
                    }

                    errorText +=
                        "💡 Try another quality.";

                    await conn.sendMessage(
                        session.from,
                        {
                            text: errorText
                        },
                        {
                            quoted: msg
                        }
                    );

                } finally {

                    // ==================================================
                    // DELETE TEMP FILES
                    // ==================================================

                    try {
                        if (fs.existsSync(inputFile)) {
                            fs.unlinkSync(inputFile);
                        }
                    } catch {}

                    try {
                        if (fs.existsSync(outputFile)) {
                            fs.unlinkSync(outputFile);
                        }
                    } catch {}
                }

                // ==================================================
                // IMPORTANT:
                // DO NOT DELETE SESSION HERE
                //
                // Therefore:
                // 1.1 -> 1.3 -> 1.4 -> 2.5 -> ...
                // unlimited replies work.
                // ==================================================

            } catch (error) {

                console.error(
                    "[REPLY HANDLER ERROR]",
                    error
                );

            }
        }
    });
}

// ======================================================
// VIDEO COMMAND
// ======================================================

cmd({
    pattern: "video",
    alias: ["ytv", "ytvideo"],
    desc: "Download YouTube videos",
    category: "download",
    react: "📽️",
    filename: __filename
},
async (
    conn,
    mek,
    m,
    {
        from,
        args,
        reply
    }
) => {

    try {

        // ==================================================
        // GET QUERY
        // ==================================================

        const query = args.join(" ").trim();

        if (!query) {
            return reply(
                "❌ Please give a YouTube URL or search query."
            );
        }

        // ==================================================
        // SEARCH YOUTUBE
        // ==================================================

        let data;

        if (
            query.includes("youtube.com") ||
            query.includes("youtu.be")
        ) {

            let searchUrl = query;

            try {

                const result =
                    await yts({
                        videoId:
                            query
                                .split("v=")[1]
                                ?.split("&")[0]
                    });

                if (result) {
                    data = result;
                }

            } catch {}

            if (!data) {
                const search =
                    await yts(query);

                if (!search.videos.length) {
                    return reply(
                        "❌ Video not found!"
                    );
                }

                data = search.videos[0];
            }

        } else {

            const search =
                await yts(query);

            if (!search.videos.length) {
                return reply(
                    "❌ Video not found!"
                );
            }

            data = search.videos[0];
        }

        // ==================================================
        // YOUTUBE URL
        // ==================================================

        const youtubeUrl = data.url;

        // ==================================================
        // ORIGINAL TEMPLATE
        // DO NOT CHANGE
        // ==================================================

        const caption = `*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

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
        // SEND MENU
        // ==================================================

        const sentMessage = await conn.sendMessage(
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

        // ==================================================
        // ENABLE UNLIMITED REPLIES
        // ==================================================

        ensureReplyListener(conn);

        const sessions =
            getSessions(conn);

        const messageId =
            sentMessage.key.id;

        sessions.set(
            messageId,
            {
                from: from,
                url: youtubeUrl,
                title: data.title
            }
        );

        console.log(
            `✅ Video menu active: ${messageId}`
        );

    } catch (error) {

        console.error(
            "[VIDEO COMMAND ERROR]",
            error
        );

        return reply(
            "❌ An error occurred while processing the video."
        );
    }
});
