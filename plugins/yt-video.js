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
FN:ChatGPT
ORG:RANUMITHA-X-MD;
TEL;type=CELL;type=VOICE;waid=94700000000:+94 70 000 0000
END:VCARD`
        }
    }
};

// ======================================================
// API
// ======================================================

const API_URL =
    "https://api-ytdlwsmd-mini.vercel.app/api/download";

// ======================================================
// REPLY TEXT
// ======================================================

function getReplyText(m) {
    return (
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        m?.message?.imageMessage?.caption ||
        m?.message?.videoMessage?.caption ||
        ""
    ).trim();
}

// ======================================================
// YOUTUBE ID
// ======================================================

function getYouTubeId(url) {
    if (!url) return null;

    try {
        const u = new URL(url);

        if (u.hostname.includes("youtu.be")) {
            return u.pathname.split("/")[1] || null;
        }

        if (u.hostname.includes("youtube.com")) {

            // /watch?v=
            if (u.searchParams.get("v")) {
                return u.searchParams.get("v");
            }

            // /shorts/ID
            if (u.pathname.startsWith("/shorts/")) {
                return u.pathname.split("/")[2] || null;
            }

            // /embed/ID
            if (u.pathname.startsWith("/embed/")) {
                return u.pathname.split("/")[2] || null;
            }
        }

    } catch (e) {
        return null;
    }

    return null;
}

// ======================================================
// NORMALIZE YOUTUBE URL
// ======================================================

function normalizeYouTubeUrl(url) {
    const id = getYouTubeId(url);

    if (!id) return null;

    return `https://www.youtube.com/watch?v=${id}`;
}

// ======================================================
// QUALITY
// ======================================================

function validQuality(q) {
    const allowed = ["144", "360", "480", "720", "1080"];

    return allowed.includes(String(q))
        ? String(q)
        : "360";
}

// ======================================================
// TEMP DIRECTORY
// ======================================================

const TEMP_DIR = path.join(process.cwd(), "temp");

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, {
        recursive: true
    });
}

// ======================================================
// DOWNLOAD FILE FROM API
// ======================================================

async function downloadFile(url, outputPath) {

    if (!url) {
        throw new Error("Download URL not found");
    }

    const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",

        // IMPORTANT FOR LONG VIDEOS
        timeout: 0,

        maxContentLength: Infinity,
        maxBodyLength: Infinity,

        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36",
            "Accept": "*/*",
            "Connection": "keep-alive"
        }
    });

    return new Promise((resolve, reject) => {

        const writer = fs.createWriteStream(outputPath);

        response.data.pipe(writer);

        response.data.on("error", reject);
        writer.on("error", reject);

        writer.on("finish", () => {
            resolve(outputPath);
        });
    });
}

// ======================================================
// GET API RESPONSE
// ======================================================

async function getApiData(videoUrl, quality) {

    const url =
        `${API_URL}?url=${encodeURIComponent(videoUrl)}` +
        `&quality=${encodeURIComponent(quality)}` +
        `&mode=separate`;

    const response = await axios.get(url, {
        timeout: 120000,

        maxContentLength: Infinity,
        maxBodyLength: Infinity,

        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36",
            "Accept": "application/json"
        }
    });

    if (!response.data) {
        throw new Error("Empty API response");
    }

    return response.data;
}

// ======================================================
// FIND URL INSIDE API RESPONSE
// ======================================================

function findUrl(obj, keys = []) {

    if (!obj) return null;

    if (typeof obj === "string") {

        if (
            obj.startsWith("http://") ||
            obj.startsWith("https://")
        ) {
            return obj;
        }

        return null;
    }

    if (Array.isArray(obj)) {

        for (const item of obj) {

            const result = findUrl(item, keys);

            if (result) return result;
        }

        return null;
    }

    if (typeof obj === "object") {

        // Preferred keys first
        for (const key of keys) {

            if (
                obj[key] &&
                typeof obj[key] === "string" &&
                (
                    obj[key].startsWith("http://") ||
                    obj[key].startsWith("https://")
                )
            ) {
                return obj[key];
            }
        }

        for (const key of Object.keys(obj)) {

            const result = findUrl(obj[key], keys);

            if (result) return result;
        }
    }

    return null;
}

// ======================================================
// GET VIDEO + AUDIO URL FROM API
// ======================================================

function extractStreams(data) {

    const videoKeys = [
        "video",
        "videoUrl",
        "video_url",
        "videoURL",
        "download",
        "downloadUrl",
        "download_url",
        "url"
    ];

    const audioKeys = [
        "audio",
        "audioUrl",
        "audio_url",
        "audioURL"
    ];

    let videoUrl = null;
    let audioUrl = null;

    // Common structure
    const result = data?.result || data?.data || data;

    if (result?.video) {
        videoUrl =
            typeof result.video === "string"
                ? result.video
                : findUrl(result.video, videoKeys);
    }

    if (result?.audio) {
        audioUrl =
            typeof result.audio === "string"
                ? result.audio
                : findUrl(result.audio, audioKeys);
    }

    // Generic fallback
    if (!videoUrl) {
        videoUrl = findUrl(result, videoKeys);
    }

    if (!audioUrl) {
        audioUrl = findUrl(result, audioKeys);
    }

    return {
        videoUrl,
        audioUrl
    };
}

// ======================================================
// MERGE VIDEO + AUDIO
// ======================================================

function mergeVideoAudio(videoPath, audioPath, outputPath) {

    return new Promise((resolve, reject) => {

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

            .on("start", command => {
                console.log("FFmpeg:", command);
            })

            .on("progress", progress => {
                if (progress.percent) {
                    console.log(
                        `Merge: ${progress.percent.toFixed(1)}%`
                    );
                }
            })

            .on("error", error => {
                console.error("FFmpeg Error:", error);
                reject(error);
            })

            .on("end", () => {
                resolve(outputPath);
            })

            .save(outputPath);
    });
}

// ======================================================
// DOWNLOAD USING API
// ======================================================

async function downloadUsingAPI(videoUrl, quality) {

    const apiData =
        await getApiData(videoUrl, quality);

    console.log(
        "API RESPONSE:",
        JSON.stringify(apiData).slice(0, 3000)
    );

    const streams =
        extractStreams(apiData);

    if (!streams.videoUrl) {
        throw new Error(
            "API did not return a video URL"
        );
    }

    const id =
        `${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`;

    const videoPath =
        path.join(
            TEMP_DIR,
            `${id}_video.mp4`
        );

    const audioPath =
        path.join(
            TEMP_DIR,
            `${id}_audio.m4a`
        );

    const outputPath =
        path.join(
            TEMP_DIR,
            `${id}_final.mp4`
        );

    try {

        // ==================================================
        // VIDEO DOWNLOAD
        // ==================================================

        await downloadFile(
            streams.videoUrl,
            videoPath
        );

        // ==================================================
        // IF API RETURNS AUDIO
        // ==================================================

        if (streams.audioUrl) {

            await downloadFile(
                streams.audioUrl,
                audioPath
            );

            await mergeVideoAudio(
                videoPath,
                audioPath,
                outputPath
            );

        } else {

            // API already returned combined video
            fs.renameSync(
                videoPath,
                outputPath
            );
        }

        // ==================================================
        // VALIDATE
        // ==================================================

        if (
            !fs.existsSync(outputPath) ||
            fs.statSync(outputPath).size < 10000
        ) {
            throw new Error(
                "Downloaded file is invalid"
            );
        }

        return {
            file: outputPath,
            title:
                apiData?.result?.title ||
                apiData?.data?.title ||
                "YouTube Video"
        };

    } catch (error) {

        // Cleanup
        for (const file of [
            videoPath,
            audioPath,
            outputPath
        ]) {

            try {

                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }

            } catch (_) {}
        }

        throw error;
    }
}

// ======================================================
// VIDEO COMMAND
// ======================================================

cmd(
{
    pattern: "video",
    alias: ["ytvideo", "ytv", "yt"],
    desc: "Download YouTube Video",
    category: "download",
    react: "🎥",
    filename: __filename
},

async (
    conn,
    mek,
    m,
    {
        from,
        q,
        reply
    }
) => {

    try {

        const input =
            (q || getReplyText(m)).trim();

        if (!input) {

            return reply(
                "❌ Please give a YouTube link or video name."
            );
        }

        // ==================================================
        // SEARCH / DIRECT URL
        // ==================================================

        let data = null;

        const youtubeId =
            getYouTubeId(input);

        if (youtubeId) {

            const cleanUrl =
                normalizeYouTubeUrl(input);

            const search =
                await yts({
                    videoId: youtubeId
                });

            if (
                search &&
                search.videos &&
                search.videos.length
            ) {
                data = search.videos[0];
            }

            // Fallback metadata
            if (!data) {

                data = {
                    title: "YouTube Video",
                    timestamp: "Unknown",
                    ago: "Unknown",
                    views: "Unknown",
                    url: cleanUrl
                };
            }

            data.url = cleanUrl;

        } else {

            const search =
                await yts(input);

            if (
                !search ||
                !search.videos ||
                !search.videos.length
            ) {

                return reply(
                    "❌ No results found."
                );
            }

            data = search.videos[0];
        }

        // ==================================================
        // ORIGINAL TEMPLATE — DO NOT CHANGE
        // ==================================================

        const menu = `
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

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛
`;

        const sent =
            await conn.sendMessage(
                from,
                {
                    text: menu
                },
                {
                    quoted: fakevCard
                }
            );

        // ==================================================
        // LISTENER
        // ==================================================

        const listener =
            async (
                update
            ) => {

                try {

                    const messages =
                        update?.messages;

                    if (!messages?.length) {
                        return;
                    }

                    const msg =
                        messages[0];

                    if (!msg?.message) {
                        return;
                    }

                    const msgFrom =
                        msg.key.remoteJid;

                    if (msgFrom !== from) {
                        return;
                    }

                    const text =
                        getReplyText(msg);

                    if (!text) {
                        return;
                    }

                    // Must reply to menu
                    const context =
                        msg.message?.extendedTextMessage
                            ?.contextInfo;

                    const quotedId =
                        context?.stanzaId;

                    if (
                        quotedId &&
                        quotedId !== sent.key.id
                    ) {
                        return;
                    }

                    // ==================================================
                    // OPTION
                    // ==================================================

                    const option =
                        text.toLowerCase().trim();

                    const options = {

                        "1.1": {
                            quality: "144",
                            document: false
                        },

                        "1.2": {
                            quality: "360",
                            document: false
                        },

                        "1.3": {
                            quality: "480",
                            document: false
                        },

                        "1.4": {
                            quality: "720",
                            document: false
                        },

                        "1.5": {
                            quality: "1080",
                            document: false
                        },

                        "2.1": {
                            quality: "144",
                            document: true
                        },

                        "2.2": {
                            quality: "360",
                            document: true
                        },

                        "2.3": {
                            quality: "480",
                            document: true
                        },

                        "2.4": {
                            quality: "720",
                            document: true
                        },

                        "2.5": {
                            quality: "1080",
                            document: true
                        }
                    };

                    const selected =
                        options[option];

                    if (!selected) {
                        return;
                    }

                    // ==================================================
                    // REACT
                    // ==================================================

                    await conn.sendMessage(
                        from,
                        {
                            react: {
                                text: "⏳",
                                key: msg.key
                            }
                        }
                    );

                    await reply(
                        `⏳ Downloading ${selected.quality}p...\n\nPlease wait...`
                    );

                    // ==================================================
                    // DOWNLOAD
                    // ==================================================

                    const result =
                        await downloadUsingAPI(
                            data.url,
                            validQuality(
                                selected.quality
                            )
                        );

                    // ==================================================
                    // SEND
                    // ==================================================

                    if (selected.document) {

                        await conn.sendMessage(
                            from,
                            {
                                document: {
                                    url: result.file
                                },
                                mimetype:
                                    "video/mp4",
                                fileName:
                                    `${data.title}.mp4`,
                                caption:
                                    `📂 *${data.title}*\n\n> RANUMITHA-X-MD`
                            },
                            {
                                quoted: msg
                            }
                        );

                    } else {

                        await conn.sendMessage(
                            from,
                            {
                                video: {
                                    url: result.file
                                },
                                mimetype:
                                    "video/mp4",
                                fileName:
                                    `${data.title}.mp4`,
                                caption:
                                    `🎥 *${data.title}*\n\n> RANUMITHA-X-MD`
                            },
                            {
                                quoted: msg
                            }
                        );
                    }

                    // ==================================================
                    // SUCCESS REACTION
                    // ==================================================

                    await conn.sendMessage(
                        from,
                        {
                            react: {
                                text: "✅",
                                key: msg.key
                            }
                        }
                    );

                    // ==================================================
                    // CLEAN FILE
                    // ==================================================

                    try {

                        if (
                            result.file &&
                            fs.existsSync(
                                result.file
                            )
                        ) {

                            fs.unlinkSync(
                                result.file
                            );
                        }

                    } catch (_) {}

                } catch (error) {

                    console.error(
                        "VIDEO ERROR:",
                        error
                    );

                    await reply(
                        `❌ *Download Failed*\n\n${error.message || "Unknown error"}`
                    );

                    try {

                        await conn.sendMessage(
                            from,
                            {
                                react: {
                                    text: "❌",
                                    key: m.key
                                }
                            }
                        );

                    } catch (_) {}
                }
            };

        // ==================================================
        // REGISTER LISTENER
        // ==================================================

        conn.ev.on(
            "messages.upsert",
            listener
        );

        // ==================================================
        // REMOVE LISTENER AFTER 10 MINUTES
        // ==================================================

        setTimeout(
            () => {

                try {
                    conn.ev.off(
                        "messages.upsert",
                        listener
                    );
                } catch (_) {}

            },
            10 * 60 * 1000
        );

    } catch (error) {

        console.error(
            "VIDEO COMMAND ERROR:",
            error
        );

        return reply(
            `❌ Error: ${error.message || "Something went wrong"}`
        );
    }
});
