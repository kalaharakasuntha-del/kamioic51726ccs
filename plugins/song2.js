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

        /* ================= QUERY ================= */

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

        /* ================= SHORTS URL ================= */

        if (query.includes("youtube.com/shorts/")) {
            const id = query.split("/shorts/")[1].split(/[?&]/)[0];
            query = `https://www.youtube.com/watch?v=${id}`;
        }

        await conn.sendMessage(from, {
            react: {
                text: "🎵",
                key: m.key
            }
        });

        /* ================= YOUTUBE SEARCH ================= */

        const search = await yts(query);

        if (!search?.videos?.length) {
            return reply("❌ Song not found.");
        }

        const video = search.videos[0];

        /* ================= DARK-KNIGHT API ================= */

        const api =
            `https://dark-knight-yt-dl-api.vercel.app/download/ytmp3?url=${encodeURIComponent(video.url)}`;

        const { data } = await axios.get(api, {
            timeout: 60000
        });

        if (
            !data?.status ||
            !data?.download?.status ||
            !data?.download?.url
        ) {
            console.log("Dark-Knight API Response:", data);
            return reply("❌ Download API failed.");
        }

        const songUrl = data.download.url;

        /* ================= METADATA ================= */

        const title =
            data.metadata?.title ||
            video.title ||
            "Unknown Song";

        const thumbnail =
            data.metadata?.thumbnail ||
            video.thumbnail;

        const duration =
            data.metadata?.duration?.timestamp ||
            video.timestamp ||
            "Unknown";

        const filename =
            data.download?.filename ||
            `${title}.mp3`;

        /* ================= MENU ================= */

        const sentMsg = await conn.sendMessage(
            from,
            {
                image: {
                    url: thumbnail
                },

                caption: `
🎶 *RANUMITHA-X-MD SONG DOWNLOADER* 🎶

📑 *Title:* ${title}
⏱ *Duration:* ${duration}
📆 *Uploaded:* ${video.ago}
👁 *Views:* ${video.views}

🔗 *YouTube:* ${video.url}

🎧 *Quality:* ${data.download?.quality || "128kbps"}

🔽 *Reply with your choice:*

1️⃣ Audio Type 🎵
2️⃣ Document Type 📁
3️⃣ Voice Note Type 🎤

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝐃 🌛
`,
            },
            {
                quoted: fakevCard
            }
        );

        const messageID = sentMsg.key.id;

        /* ================= REPLY LISTENER ================= */

        const handler = async (msgData) => {

            try {

                const receivedMsg = msgData.messages?.[0];

                if (!receivedMsg?.message) return;

                const receivedText =
                    receivedMsg.message.conversation ||
                    receivedMsg.message.extendedTextMessage?.text ||
                    "";

                const senderID =
                    receivedMsg.key.remoteJid;

                const contextInfo =
                    receivedMsg.message.extendedTextMessage
                        ?.contextInfo;

                const isReplyToBot =
                    contextInfo?.stanzaId === messageID;

                if (!isReplyToBot) return;

                const option =
                    receivedText.trim();

                await conn.sendMessage(senderID, {
                    react: {
                        text: "⬇️",
                        key: receivedMsg.key
                    }
                });

                /* ================= AUDIO ================= */

                if (option === "1") {

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "⬆️",
                            key: receivedMsg.key
                        }
                    });

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

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "✔️",
                            key: receivedMsg.key
                        }
                    });
                }

                /* ================= DOCUMENT ================= */

                else if (option === "2") {

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "⬆️",
                            key: receivedMsg.key
                        }
                    });

                    const response = await axios.get(
                        songUrl,
                        {
                            responseType: "arraybuffer",
                            timeout: 120000
                        }
                    );

                    const cleanName =
                        title
                            .replace(/[\\/:*?"<>|]/g, "")
                            .trim() || "song";

                    await conn.sendMessage(
                        senderID,
                        {
                            document: Buffer.from(response.data),
                            mimetype: "audio/mpeg",
                            fileName: `${cleanName}.mp3`
                        },
                        {
                            quoted: receivedMsg
                        }
                    );

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "✔️",
                            key: receivedMsg.key
                        }
                    });
                }

                /* ================= VOICE NOTE ================= */

                else if (option === "3") {

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "⬆️",
                            key: receivedMsg.key
                        }
                    });

                    const timestamp = Date.now();

                    const mp3Path = path.join(
                        __dirname,
                        `${timestamp}.mp3`
                    );

                    const opusPath = path.join(
                        __dirname,
                        `${timestamp}.opus`
                    );

                    try {

                        /* Download MP3 */

                        const response = await axios.get(
                            songUrl,
                            {
                                responseType: "stream",
                                timeout: 120000
                            }
                        );

                        const writer =
                            fs.createWriteStream(mp3Path);

                        response.data.pipe(writer);

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

                        /* Convert MP3 → OPUS */

                        await new Promise(
                            (resolve, reject) => {

                                ffmpeg(mp3Path)
                                    .audioCodec("libopus")
                                    .audioChannels(1)
                                    .audioFrequency(48000)
                                    .format("opus")
                                    .on("end", resolve)
                                    .on("error", reject)
                                    .save(opusPath);
                            }
                        );

                        /* Send Voice Note */

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
                                quoted: receivedMsg
                            }
                        );

                        await conn.sendMessage(senderID, {
                            react: {
                                text: "✔️",
                                key: receivedMsg.key
                            }
                        });

                    } finally {

                        /* Cleanup */

                        if (fs.existsSync(mp3Path)) {
                            fs.unlinkSync(mp3Path);
                        }

                        if (fs.existsSync(opusPath)) {
                            fs.unlinkSync(opusPath);
                        }
                    }
                }

                /* ================= INVALID OPTION ================= */

                else {

                    await conn.sendMessage(senderID, {
                        react: {
                            text: "😒",
                            key: receivedMsg.key
                        }
                    });

                    await conn.sendMessage(
                        senderID,
                        {
                            text: "❌ *Invalid option!*\n\nReply with *1*, *2*, or *3*."
                        },
                        {
                            quoted: receivedMsg
                        }
                    );
                }

            } catch (err) {

                console.error(
                    "Song Reply Handler Error:",
                    err
                );

                await conn.sendMessage(
                    msgData.messages?.[0]?.key?.remoteJid,
                    {
                        text:
                            "❌ *Download failed!*\nPlease try again."
                    }
                );
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

        reply(
            "❌ *Error downloading or sending audio.*"
        );
    }
});
