const axios = require('axios');
const yts = require('yt-search');
const { cmd } = require('../command');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

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
    pattern: "video",
    alias: ["ytvideo"],
    react: "🎬",
    desc: "Download YouTube MP4",
    category: "download",
    use: ".video <query>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {

    try {

        // 1️⃣ Determine the query
        let query = q?.trim();

        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }

        if (!query) {
            return reply(
                "⚠️ Please provide a video name or YouTube link (or reply to a message)."
            );
        }

        // 2️⃣ Convert Shorts link to normal YouTube URL
        if (query.includes("youtube.com/shorts/")) {

            const videoId =
                query.split("/shorts/")[1].split(/[?&]/)[0];

            if (!videoId) {
                return reply("❌ Invalid YouTube Shorts link.");
            }

            query =
                `https://www.youtube.com/watch?v=${videoId}`;
        }

        // 3️⃣ YouTube search
        let data;

        const search = await yts(query);

        if (!search.videos || !search.videos.length) {
            return reply("*❌ No results found.*");
        }

        data = search.videos[0];

        const ytUrl = data.url;

        // 4️⃣ YTDLWSMD API
        const formats = {

            "144p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=144p&mode=separate`,

            "360p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=360p&mode=separate`,

            "480p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=480p&mode=separate`,

            "720p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=720p&mode=separate`,

            "1080p":
                `https://api-ytdlwsmd-mini.vercel.app/api/download?url=${encodeURIComponent(ytUrl)}&quality=1080p&mode=separate`
        };

        // 5️⃣ Menu
        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 \`Title:\`* ${data.title}
*⏱️ \`Duration:\`* ${data.timestamp}
*📆 \`Uploaded:\`* ${data.ago}
*📊 \`Views:\`* ${data.views}
*🔗 \`Link:\`* ${data.url}

🔢 *Reply Below Number*

1. *Video FILE 📽️*
   1.1 144p Qulity 📽️
   1.2 360p Qulity 📽️
   1.3 480p Qulity 📽️
   1.4 720p Qulity 📽️
   1.5 1080p Qulity 📽️

2. *Document FILE 📂*
   2.1 144p Qulity 📂
   2.2 360p Qulity 📂
   2.3 480p Qulity 📂
   2.4 720p Qulity 📂
   2.5 1080p Qulity 📂

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        const sentMsg = await conn.sendMessage(
            from,
            {
                image: { url: data.thumbnail },
                caption
            },
            { quoted: fakevCard }
        );

        const messageID = sentMsg.key.id;

        // 6️⃣ Listen for reply
        conn.ev.on("messages.upsert", async (msgData) => {

            try {

                const receivedMsg = msgData.messages?.[0];

                if (!receivedMsg?.message) return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text;

                if (!receivedText) return;

                const senderID =
                    receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage?.contextInfo;

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                if (!isReplyToBot || senderID !== from) return;

                let selectedFormat;
                let isDocument = false;

                switch (receivedText.trim().toUpperCase()) {

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
                                text: "*❌ Invalid option!*"
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                }

                // Download reaction
                await conn.sendMessage(senderID, {
                    react: {
                        text: "⬇️",
                        key: receivedMsg.key
                    }
                });

                try {

                    // 7️⃣ Call API
                    const response = await axios.get(
                        formats[selectedFormat],
                        {
                            timeout: 180000,
                            validateStatus: () => true
                        }
                    );

                    const apiRes = response.data;

                    // API HTTP error
                    if (response.status !== 200) {

                        console.error(
                            "YTDL API ERROR:",
                            response.status,
                            apiRes
                        );

                        await conn.sendMessage(senderID, {
                            react: {
                                text: "❌",
                                key: receivedMsg.key
                            }
                        });

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ ${selectedFormat} download failed.\n\n` +
                                    `API Status: ${response.status}\n\n` +
                                    `Try another quality.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    // API response validation
                    if (
                        !apiRes ||
                        apiRes.status !== true ||
                        !apiRes.result
                    ) {

                        await conn.sendMessage(senderID, {
                            react: {
                                text: "❌",
                                key: receivedMsg.key
                            }
                        });

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ ${selectedFormat} is not available.\n` +
                                    `Please try another quality.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    const result = apiRes.result;

                    /*
                     * API can return:
                     *
                     * result.video
                     * result.audio
                     *
                     * OR only:
                     *
                     * result.video
                     */

                    const videoUrl = result.video;
                    const audioUrl = result.audio;

                    if (!videoUrl) {

                        await conn.sendMessage(senderID, {
                            react: {
                                text: "❌",
                                key: receivedMsg.key
                            }
                        });

                        return conn.sendMessage(
                            senderID,
                            {
                                text:
                                    `❌ No video stream found for ${selectedFormat}.`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }

                    // Upload reaction
                    await conn.sendMessage(senderID, {
                        react: {
                            text: "⬆️",
                            key: receivedMsg.key
                        }
                    });

                    const safeTitle =
                        data.title
                            .replace(/[^\w\s-]/gi, "")
                            .trim()
                            .substring(0, 100);

                    /*
                     * 8️⃣ If API provides separate audio,
                     * merge video + audio using FFmpeg.
                     */

                    if (audioUrl) {

                        const tempDir =
                            path.join(__dirname, "../temp");

                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, {
                                recursive: true
                            });
                        }

                        const videoFile =
                            path.join(
                                tempDir,
                                `video_${Date.now()}.mp4`
                            );

                        const audioFile =
                            path.join(
                                tempDir,
                                `audio_${Date.now()}.m4a`
                            );

                        const outputFile =
                            path.join(
                                tempDir,
                                `merged_${Date.now()}.mp4`
                            );

                        try {

                            // Download video
                            const videoResponse =
                                await axios.get(videoUrl, {
                                    responseType: "arraybuffer",
                                    timeout: 180000
                                });

                            fs.writeFileSync(
                                videoFile,
                                videoResponse.data
                            );

                            // Download audio
                            const audioResponse =
                                await axios.get(audioUrl, {
                                    responseType: "arraybuffer",
                                    timeout: 180000
                                });

                            fs.writeFileSync(
                                audioFile,
                                audioResponse.data
                            );

                            // Merge
                            await new Promise(
                                (resolve, reject) => {

                                    ffmpeg()
                                        .input(videoFile)
                                        .input(audioFile)

                                        .outputOptions([
                                            "-c:v copy",
                                            "-c:a aac",
                                            "-map 0:v:0",
                                            "-map 1:a:0",
                                            "-shortest",
                                            "-movflags +faststart"
                                        ])

                                        .output(outputFile)

                                        .on("end", resolve)

                                        .on("error", reject)

                                        .run();
                                }
                            );

                            // Send merged video
                            if (isDocument) {

                                await conn.sendMessage(
                                    senderID,
                                    {
                                        document: {
                                            url: outputFile
                                        },
                                        mimetype: "video/mp4",
                                        fileName:
                                            `${safeTitle} - ${selectedFormat}.mp4`
                                    },
                                    {
                                        quoted: receivedMsg
                                    }
                                );

                            } else {

                                await conn.sendMessage(
                                    senderID,
                                    {
                                        video: {
                                            url: outputFile
                                        },
                                        mimetype: "video/mp4",
                                        caption:
                                            `*${data.title}*\n` +
                                            `*Quality:* ${selectedFormat}`,
                                        ptt: false
                                    },
                                    {
                                        quoted: receivedMsg
                                    }
                                );
                            }

                        } finally {

                            // Cleanup
                            try {
                                if (fs.existsSync(videoFile))
                                    fs.unlinkSync(videoFile);

                                if (fs.existsSync(audioFile))
                                    fs.unlinkSync(audioFile);

                                if (fs.existsSync(outputFile))
                                    fs.unlinkSync(outputFile);

                            } catch (cleanupError) {
                                console.error(
                                    "Cleanup Error:",
                                    cleanupError
                                );
                            }
                        }

                    } else {

                        /*
                         * API returned a combined video.
                         */

                        if (isDocument) {

                            await conn.sendMessage(
                                senderID,
                                {
                                    document: {
                                        url: videoUrl
                                    },
                                    mimetype: "video/mp4",
                                    fileName:
                                        `${safeTitle} - ${selectedFormat}.mp4`
                                },
                                {
                                    quoted: receivedMsg
                                }
                            );

                        } else {

                            await conn.sendMessage(
                                senderID,
                                {
                                    video: {
                                        url: videoUrl
                                    },
                                    mimetype: "video/mp4",
                                    caption:
                                        `*${data.title}*\n` +
                                        `*Quality:* ${selectedFormat}`,
                                    ptt: false
                                },
                                {
                                    quoted: receivedMsg
                                }
                            );
                        }
                    }

                    // Success reaction
                    await conn.sendMessage(senderID, {
                        react: {
                            text: "✔️",
                            key: receivedMsg.key
                        }
                    });

                } catch (error) {

                    console.error(
                        "Download Error:",
                        error
                    );

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "❌",
                            key: receivedMsg.key
                        }
                    });

                    await conn.sendMessage(
                        senderID,
                        {
                            text:
                                `❌ Error downloading ${selectedFormat}:\n\n` +
                                `${error.message}`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

            } catch (listenerError) {

                console.error(
                    "Reply Listener Error:",
                    listenerError
                );
            }
        });

    } catch (error) {

        console.error(
            "Video Command Error:",
            error
        );

        reply(
            "❌ An error occurred while processing your request. Please try again later."
        );
    }
});
