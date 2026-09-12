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
// YOUTUBE ID EXTRACTOR
// ======================================================

function getYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ======================================================
// API URL
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
// DOWNLOAD STREAM
// ======================================================

async function downloadFile(url, outputPath) {
    const response = await axios.get(url, {
        responseType: "stream",
        timeout: 180000,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
            "Accept": "*/*"
        }
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        writer.on("finish", () => {
            writer.close();
            resolve(outputPath);
        });

        writer.on("error", reject);
        response.data.on("error", reject);
    });
}

// ======================================================
// MERGE VIDEO AND AUDIO FAST (STREAM COPY)
// ======================================================

function mergeVideoAndAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
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
            .on("end", () => resolve(outputPath))
            .on("error", reject);
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
    use: ".video <query/shorts link>",
    filename: __filename
},

async (
    conn,
    mek,
    m,
    { from, reply, q }
) => {

    let replyHandler;

    try {

        // ==================================================
        // 1. QUERY / LINK CHECK
        // ==================================================

        let query = q?.trim();

        if (!query && m?.quoted) {
            query = getReplyText(m);
        }

        if (!query) {
            return reply(
                "⚠️ Please provide a video name or YouTube/Shorts link.\n\n" +
                "Example:\n" +
                ".video https://youtube.com/shorts/xxxxxx\n\n" +
                "Or reply to a message with:\n" +
                "."
            );
        }

        // ==================================================
        // 2. YOUTUBE SEARCH WITH FALLBACK
        // ==================================================

        const videoId = getYouTubeId(query);
        let data = null;

        if (videoId) {
            try {
                data = await yts({ videoId: videoId });
            } catch (e) {
                try {
                    const search = await yts(`https://www.youtube.com/watch?v=${videoId}`);
                    if (search && search.videos && search.videos.length) {
                        data = search.videos[0];
                    }
                } catch (err) {
                    console.log("yt-search direct lookup failed, fallback applied.");
                }
            }

            // Fallback if yt-search fails completely for a direct link/shorts
            if (!data) {
                data = {
                    title: "YouTube Video / Shorts",
                    timestamp: "N/A",
                    ago: "N/A",
                    views: "N/A",
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                };
            }
        } else {
            try {
                const search = await yts(query);
                if (search && search.videos && search.videos.length) {
                    data = search.videos[0];
                }
            } catch (err) {
                console.error("YouTube Search Error:", err);
            }
        }

        if (!data || !data.url) {
            return reply("*❌ No results found or YouTube blocked search.*");
        }

        const ytUrl = data.url;
        console.log("Selected YouTube/Shorts URL:", ytUrl);

        // ==================================================
        // 3. CAPTION TEMPLATE
        // ==================================================

        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 \`Title:\`* ${data.title}
*⏱️ \`Duration:\`* ${data.timestamp || data.duration?.timestamp || "N/A"}
*📆 \`Uploaded:\`* ${data.ago || "N/A"}
*📊 \`Views:\`* ${data.views || "N/A"}
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

        const sentMsg = await conn.sendMessage(
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

        const messageID = sentMsg.key.id;

        // ==================================================
        // 5. REPLY LISTENER
        // ==================================================

        replyHandler = async (msgData) => {

            let senderID;
            let receivedMsg;

            try {

                receivedMsg = msgData.messages?.[0];
                if (!receivedMsg?.message) return;

                senderID = receivedMsg.key.remoteJid;
                if (senderID !== from) return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text ||
                    receivedMsg.message.imageMessage?.caption ||
                    receivedMsg.message.videoMessage?.caption ||
                    "";

                if (!receivedText) return;

                const option = receivedText.trim().toLowerCase();

                const contextInfo =
                    receivedMsg.message.extendedTextMessage?.contextInfo;

                const quotedMessageID = contextInfo?.stanzaId;

                if (quotedMessageID !== messageID) return;

                // ==================================================
                // QUALITY OPTIONS
                // ==================================================

                let selectedFormat = null;
                let isDocument = false;

                switch (option) {
                    case "1.1": selectedFormat = "144p"; break;
                    case "1.2": selectedFormat = "360p"; break;
                    case "1.3": selectedFormat = "480p"; break;
                    case "1.4": selectedFormat = "720p"; break;
                    case "1.5": selectedFormat = "1080p"; break;

                    case "2.1": selectedFormat = "144p"; isDocument = true; break;
                    case "2.2": selectedFormat = "360p"; isDocument = true; break;
                    case "2.3": selectedFormat = "480p"; isDocument = true; break;
                    case "2.4": selectedFormat = "720p"; isDocument = true; break;
                    case "2.5": selectedFormat = "1080p"; isDocument = true; break;

                    default:
                        return conn.sendMessage(
                            senderID,
                            { text: "*❌ Invalid option!*\n\nReply with 1.1 - 2.5." },
                            { quoted: receivedMsg }
                        );
                }

                // Reaction: Downloading
                await conn.sendMessage(senderID, {
                    react: { text: "⬇️", key: receivedMsg.key }
                });

                // Paths setup
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const uniqueID = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                const videoInput = path.join(tempDir, `${uniqueID}_video.mp4`);
                const audioInput = path.join(tempDir, `${uniqueID}_audio.mp3`);
                const finalOutput = path.join(tempDir, `${uniqueID}_final.mp4`);

                try {
                    const apiUrl = createApiUrl(ytUrl, selectedFormat);
                    const response = await axios.get(apiUrl, {
                        timeout: 180000,
                        validateStatus: () => true,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
                            "Accept": "application/json,text/plain,*/*"
                        }
                    });

                    if (response.status !== 200) {
                        await conn.sendMessage(senderID, { react: { text: "❌", key: receivedMsg.key } });
                        return conn.sendMessage(
                            senderID,
                            { text: `❌ API Error\n\nQuality: ${selectedFormat}\nHTTP Status: ${response.status}` },
                            { quoted: receivedMsg }
                        );
                    }

                    const apiRes = response.data;
                    if (!apiRes || apiRes.status !== true || !apiRes.result) {
                        await conn.sendMessage(senderID, { react: { text: "❌", key: receivedMsg.key } });
                        return conn.sendMessage(
                            senderID,
                            { text: `❌ Unable to download ${selectedFormat}.` },
                            { quoted: receivedMsg }
                        );
                    }

                    const videoUrl = apiRes.result.video || apiRes.result.url || apiRes.result.download;
                    const audioUrl = apiRes.result.audio;

                    if (!videoUrl) {
                        return conn.sendMessage(
                            senderID,
                            { text: `❌ No video URL found for ${selectedFormat}.` },
                            { quoted: receivedMsg }
                        );
                    }

                    let targetFile = finalOutput;

                    if (audioUrl) {
                        await Promise.all([
                            downloadFile(videoUrl, videoInput),
                            downloadFile(audioUrl, audioInput)
                        ]);
                        await mergeVideoAndAudio(videoInput, audioInput, finalOutput);
                    } else {
                        await downloadFile(videoUrl, finalOutput);
                    }

                    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).size < 1000) {
                        throw new Error("Generated video file is invalid or missing.");
                    }

                    // Reaction: Uploading
                    await conn.sendMessage(senderID, {
                        react: { text: "⬆️", key: receivedMsg.key }
                    });

                    const safeTitle = (data.title || "RANUMITHA_VIDEO")
                        .replace(/[\\/:*?"<>|]/g, "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .substring(0, 100);

                    if (isDocument) {
                        await conn.sendMessage(
                            senderID,
                            {
                                document: { url: targetFile },
                                mimetype: "video/mp4",
                                fileName: `${safeTitle} - ${selectedFormat}.mp4`
                            },
                            { quoted: receivedMsg }
                        );
                    } else {
                        await conn.sendMessage(
                            senderID,
                            {
                                video: { url: targetFile },
                                mimetype: "video/mp4",
                                caption: `*${data.title}*\n\n*Quality:* ${selectedFormat}\n\n> © RANUMITHA-X-MD`,
                                ptt: false
                            },
                            { quoted: receivedMsg }
                        );
                    }

                    // Success Reaction
                    await conn.sendMessage(senderID, {
                        react: { text: "✔️", key: receivedMsg.key }
                    });

                } finally {
                    try {
                        if (fs.existsSync(videoInput)) fs.unlinkSync(videoInput);
                        if (fs.existsSync(audioInput)) fs.unlinkSync(audioInput);
                        if (fs.existsSync(finalOutput)) fs.unlinkSync(finalOutput);
                    } catch (e) {
                        console.error("Cleanup Error:", e.message);
                    }
                }

            } catch (error) {
                console.error("Video Download Error:", error);
                try {
                    if (senderID && receivedMsg) {
                        await conn.sendMessage(senderID, { react: { text: "❌", key: receivedMsg.key } });
                        await conn.sendMessage(
                            senderID,
                            { text: `❌ Error downloading ${selectedFormat || "video"}\n\n${error.message}` },
                            { quoted: receivedMsg }
                        );
                    }
                } catch (sendError) {
                    console.error("Send Error:", sendError);
                }
            }
        };

        conn.ev.on("messages.upsert", replyHandler);

    } catch (error) {
        console.error("Video Command Error:", error);
        return reply("❌ An error occurred while processing the video.\n\n" + error.message);
    }
});
