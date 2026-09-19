const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const {
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

// =====================================================
// FFMPEG
// =====================================================

ffmpeg.setFfmpegPath(ffmpegPath);

// =====================================================
// TIME PARSER
// =====================================================

function parseTime(time) {

    if (!time)
        return null;

    time = time.trim();

    // 90
    if (/^\d+$/.test(time)) {
        return parseInt(time);
    }

    // 1:20
    if (/^\d+:\d{1,2}$/.test(time)) {

        const [m, s] =
            time.split(":").map(Number);

        if (s >= 60)
            return null;

        return (m * 60) + s;
    }

    // 1:02:30
    if (/^\d+:\d{1,2}:\d{1,2}$/.test(time)) {

        const [h, m, s] =
            time.split(":").map(Number);

        if (m >= 60 || s >= 60)
            return null;

        return (
            (h * 3600) +
            (m * 60) +
            s
        );
    }

    return null;
}

// =====================================================
// GET MEDIA MESSAGE
// =====================================================

function getMediaMessage(quoted) {

    if (!quoted)
        return null;

    const msg =
        quoted.message ||
        quoted.msg ||
        quoted;

    if (msg.audioMessage)
        return {
            message: msg.audioMessage,
            type: "audio"
        };

    if (msg.documentMessage)
        return {
            message: msg.documentMessage,
            type: "document"
        };

    if (msg.videoMessage)
        return {
            message: msg.videoMessage,
            type: "video"
        };

    return null;
}

// =====================================================
// DOWNLOAD MEDIA
// =====================================================

async function downloadMedia(media) {

    const chunks = [];

    const stream =
        await downloadContentFromMessage(
            media.message,
            media.type
        );

    for await (
        const chunk of stream
    ) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

// =====================================================
// VOICECUT
// =====================================================

cmd({
    pattern: "voicecut",
    alias: [
        "vcut",
        "cutvoice"
    ],
    desc: "Cut voice/audio",
    category: "tools",
    filename: __filename

}, async (
    conn,
    m,
    store,
    {
        from,
        quoted,
        q,
        reply
    }
) => {

    let inputFile;
    let outputFile;

    try {

        // =================================================
        // CHECK REPLY
        // =================================================

        if (!quoted) {

            return reply(
                `❌ *Reply to a voice message.*

Example:

*.voicecut 1:20*`
            );
        }

        // =================================================
        // TIME
        // =================================================

        const seconds =
            parseTime(q);

        if (
            !seconds ||
            seconds <= 0
        ) {

            return reply(
                `❌ *Invalid time.*

Example:

*.voicecut 1:20*

Other examples:

*.voicecut 0:30*
*.voicecut 2:00*
*.voicecut 90*`
            );
        }

        // =================================================
        // MAX 1 HOUR
        // =================================================

        if (seconds > 3600) {

            return reply(
                "❌ Maximum duration is *1 hour*."
            );
        }

        // =================================================
        // CHECK MEDIA
        // =================================================

        const media =
            getMediaMessage(
                quoted
            );

        if (!media) {

            return reply(
                "❌ The replied message is not an audio/voice message."
            );
        }

        // =================================================
        // REACT
        // =================================================

        await conn.sendMessage(
            from,
            {
                react: {
                    text: "✂️",
                    key: m.key
                }
            }
        );

        // =================================================
        // FILES
        // =================================================

        const id =
            Date.now();

        inputFile =
            path.join(
                __dirname,
                `vcut_${id}.input`
            );

        outputFile =
            path.join(
                __dirname,
                `vcut_${id}.ogg`
            );

        // =================================================
        // DOWNLOAD
        // =================================================

        console.log(
            "[VOICECUT] Downloading..."
        );

        const buffer =
            await downloadMedia(
                media
            );

        if (
            !buffer ||
            buffer.length === 0
        ) {

            throw new Error(
                "Audio download returned empty data."
            );
        }

        fs.writeFileSync(
            inputFile,
            buffer
        );

        console.log(
            "[VOICECUT] Downloaded:",
            buffer.length,
            "bytes"
        );

        // =================================================
        // FFMPEG
        // =================================================

        await new Promise(
            (resolve, reject) => {

                ffmpeg(inputFile)

                    .setStartTime(0)

                    .duration(seconds)

                    .audioCodec("libopus")

                    .audioChannels(1)

                    .audioFrequency(48000)

                    .audioBitrate("64k")

                    .format("ogg")

                    .outputOptions([
                        "-vn",
                        "-map_metadata",
                        "-1"
                    ])

                    .on(
                        "start",
                        cmd => {

                            console.log(
                                "[VOICECUT]",
                                cmd
                            );
                        }
                    )

                    .on(
                        "end",
                        resolve
                    )

                    .on(
                        "error",
                        reject
                    )

                    .save(outputFile);
            }
        );

        // =================================================
        // CHECK OUTPUT
        // =================================================

        if (
            !fs.existsSync(outputFile)
        ) {

            throw new Error(
                "FFmpeg did not create output."
            );
        }

        const output =
            fs.readFileSync(
                outputFile
            );

        if (!output.length) {

            throw new Error(
                "Output audio is empty."
            );
        }

        // =================================================
        // SEND VOICE
        // =================================================

        await conn.sendMessage(
            from,
            {
                audio: output,

                mimetype:
                    "audio/ogg; codecs=opus",

                ptt: true
            },
            {
                quoted: m
            }
        );

        // =================================================
        // SUCCESS
        // =================================================

        await conn.sendMessage(
            from,
            {
                react: {
                    text: "✅",
                    key: m.key
                }
            }
        );

        console.log(
            "[VOICECUT] SUCCESS"
        );

    } catch (error) {

        console.error(
            "VOICECUT ERROR:",
            error
        );

        await conn.sendMessage(
            from,
            {
                text:
                    `❌ *Voice cut failed!*

🔴 ${error.message || error}`
            },
            {
                quoted: m
            }
        );

    } finally {

        // =================================================
        // CLEAN
        // =================================================

        try {

            if (
                inputFile &&
                fs.existsSync(inputFile)
            ) {
                fs.unlinkSync(
                    inputFile
                );
            }

        } catch (e) {}

        try {

            if (
                outputFile &&
                fs.existsSync(outputFile)
            ) {
                fs.unlinkSync(
                    outputFile
                );
            }

        } catch (e) {}
    }
});
