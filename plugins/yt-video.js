const axios = require('axios');
const yts = require('yt-search');
const { cmd } = require('../command');

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
        // 1️⃣ Determine the query (text or replied message)
        let query = q?.trim();

        if (!query && m?.quoted) {
            query =
                m.quoted.message?.conversation ||
                m.quoted.message?.extendedTextMessage?.text ||
                m.quoted.text;
        }

        if (!query) {
            return reply("⚠️ Please provide a video name or YouTube link (or reply to a message).");
        }

        // 2️⃣ Convert Shorts link to normal link
        if (query.includes("youtube.com/shorts/")) {
            const videoId = query.split("/shorts/")[1].split(/[?&]/)[0];

            if (!videoId) {
                return reply("❌ Invalid YouTube Shorts link.");
            }

            query = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // 3️⃣ YouTube search / direct URL
        let data;

        if (
            query.includes("youtube.com/watch?v=") ||
            query.includes("youtu.be/")
        ) {
            const search = await yts(query);

            if (!search.videos || !search.videos.length) {
                return reply("*❌ No results found.*");
            }

            data = search.videos[0];
        } else {
            const search = await yts(query);

            if (!search.videos || !search.videos.length) {
                return reply("*❌ No results found.*");
            }

            data = search.videos[0];
        }

        const ytUrl = data.url;

        // 4️⃣ Define API links for download - USING MOVANEST API
        const formats = {
            "240p": `https://www.movanest.xyz/v2/ytdl2?input=${encodeURIComponent(ytUrl)}&format=video&quality=240p`,
            "360p": `https://www.movanest.xyz/v2/ytdl2?input=${encodeURIComponent(ytUrl)}&format=video&quality=360p`,
            "480p": `https://www.movanest.xyz/v2/ytdl2?input=${encodeURIComponent(ytUrl)}&format=video&quality=480p`,
            "720p": `https://www.movanest.xyz/v2/ytdl2?input=${encodeURIComponent(ytUrl)}&format=video&quality=720p`
        };

        // 5️⃣ Send selection menu (image + caption)
        const caption = `
*📽️ RANUMITHA-X-MD VIDEO DOWNLOADER 🎥*

*🎵 \`Title:\`* ${data.title}
*⏱️ \`Duration:\`* ${data.timestamp}
*📆 \`Uploaded:\`* ${data.ago}
*📊 \`Views:\`* ${data.views}
*🔗 \`Link:\`* ${data.url}

🔢 *Reply Below Number*

1. *Video FILE 📽️*
   1.1 240p Qulity 📽️
   1.2 360p Qulity 📽️
   1.3 480p Qulity 📽️
   1.4 720p Qulity 📽️

2. *Document FILE 📂*
   2.1 240p Qulity 📂
   2.2 360p Qulity 📂
   2.3 480p Qulity 📂
   2.4 720p Qulity 📂

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        const sentMsg = await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption
        }, { quoted: fakevCard });

        const messageID = sentMsg.key.id;

        // 6️⃣ Listen for user replies
        conn.ev.on("messages.upsert", async (msgData) => {
            try {
                const receivedMsg = msgData.messages?.[0];

                if (!receivedMsg?.message) return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text;

                if (!receivedText) return;

                const senderID = receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage?.contextInfo;

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                if (isReplyToBot && senderID === from) {

                    let selectedFormat;
                    let isDocument = false;

                    switch (receivedText.trim().toUpperCase()) {
                        case "1.1":
                            selectedFormat = "240p";
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

                        case "2.1":
                            selectedFormat = "240p";
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

                        default:
                            return conn.sendMessage(
                                senderID,
                                { text: "*❌ Invalid option!*" },
                                { quoted: receivedMsg }
                            );
                    }

                    // React ⬇️ when download starts
                    await conn.sendMessage(senderID, {
                        react: {
                            text: '⬇️',
                            key: receivedMsg.key
                        }
                    });

                    try {

                        const { data: apiRes } = await axios.get(
                            formats[selectedFormat],
                            {
                                timeout: 120000
                            }
                        );

                        // Check if Movanest API response is valid
                        if (
                            !apiRes ||
                            !apiRes.status ||
                            !apiRes.results ||
                            !apiRes.results.success ||
                            !apiRes.results.recommended ||
                            !apiRes.results.recommended.dlurl
                        ) {
                            await conn.sendMessage(senderID, {
                                react: {
                                    text: '❌',
                                    key: receivedMsg.key
                                }
                            });

                            return conn.sendMessage(
                                senderID,
                                {
                                    text: `❌ Unable to download the ${selectedFormat} version. Try another one!`
                                },
                                {
                                    quoted: receivedMsg
                                }
                            );
                        }

                        const downloadUrl =
                            apiRes.results.recommended.dlurl;

                        // React ⬆️ before uploading
                        await conn.sendMessage(senderID, {
                            react: {
                                text: '⬆️',
                                key: receivedMsg.key
                            }
                        });

                        if (isDocument) {

                            await conn.sendMessage(senderID, {
                                document: {
                                    url: downloadUrl
                                },
                                mimetype: "video/mp4",
                                fileName: `${data.title.replace(/[^\w\s]/gi, '')}.mp4`
                            }, {
                                quoted: receivedMsg
                            });

                        } else {

                            await conn.sendMessage(senderID, {
                                video: {
                                    url: downloadUrl
                                },
                                mimetype: "video/mp4",
                                caption: `*${data.title}*\n*Quality:* ${selectedFormat}`,
                                ptt: false,
                            }, {
                                quoted: receivedMsg
                            });
                        }

                        // React ✅ after upload complete
                        await conn.sendMessage(senderID, {
                            react: {
                                text: '✔️',
                                key: receivedMsg.key
                            }
                        });

                    } catch (error) {

                        console.error("API Error:", error);

                        await conn.sendMessage(senderID, {
                            react: {
                                text: '❌',
                                key: receivedMsg.key
                            }
                        });

                        await conn.sendMessage(
                            senderID,
                            {
                                text: `❌ Error downloading ${selectedFormat}: ${error.message}`
                            },
                            {
                                quoted: receivedMsg
                            }
                        );
                    }
                }

            } catch (listenerError) {
                console.error("Reply Listener Error:", listenerError);
            }
        });

    } catch (error) {

        console.error("Video Command Error:", error);

        reply("❌ An error occurred while processing your request. Please try again later.");
    }
});
