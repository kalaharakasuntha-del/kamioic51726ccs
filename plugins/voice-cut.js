const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

// =====================================================
// SET FFMPEG PATH
// =====================================================

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

// =====================================================
// PARSE TIME
// Supports:
// 30
// 1:20
// 2:30
// 1:02:15
// =====================================================

function parseTime(time) {

    if (!time)
        return null;

    time = String(time).trim();

    // Seconds
    if (/^\d+$/.test(time)) {
        return parseInt(time);
    }

    // MM:SS
    if (/^\d+:\d{1,2}$/.test(time)) {

        const parts = time.split(":");

        const minutes =
            parseInt(parts[0]);

        const seconds =
            parseInt(parts[1]);

        if (seconds >= 60)
            return null;

        return (
            minutes * 60 +
            seconds
        );
    }

    // HH:MM:SS
    if (/^\d+:\d{1,2}:\d{1,2}$/.test(time)) {

        const parts = time.split(":");

        const hours =
            parseInt(parts[0]);

        const minutes =
            parseInt(parts[1]);

        const seconds =
            parseInt(parts[2]);

        if (
            minutes >= 60 ||
            seconds >= 60
        ) {
            return null;
        }

        return (
            hours * 3600 +
            minutes * 60 +
            seconds
        );
    }

    return null;
}

// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(seconds) {

    seconds =
        Math.floor(seconds);

    const minutes =
        Math.floor(seconds / 60);

    const secs =
        seconds % 60;

    return (
        `${minutes}:` +
        `${String(secs).padStart(2, "0")}`
    );
}

// =====================================================
// GET QUOTED MEDIA TYPE
// =====================================================

function getQuotedMessage(quoted) {

    if (!quoted)
        return null;

    if (quoted.message)
        return quoted.message;

    if (quoted.msg)
        return quoted.msg;

    return null;
}

// =====================================================
// VOICE CUT
// =====================================================

cmd({
    pattern: "voicecut",
    alias: [
        "vcut",
        "cutvoice"
    ],
    desc: "Cut voice/audio from beginning",
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

    let inputPath = null;
    let outputPath = null;

    try {

        // =================================================
        // CHECK QUOTED MESSAGE
        // =================================================

        if (!quoted) {

            return reply(
                `❌ *Reply to a voice/audio message.*

Example:

*.voicecut 1:20*`
            );
        }

        // =================================================
        // CHECK TIME
        // =================================================

        const cutSeconds =
            parseTime(q);

        if (
            cutSeconds === null ||
            cutSeconds <= 0
        ) {

            return reply(
                `❌ *Invalid time!*

Use:

*.voicecut 1:20*

Examples:

• 30 seconds → *.voicecut 0:30*
• 1 minute → *.voicecut 1:00*
• 1 minute 20 seconds → *.voicecut 1:20*
• 90 seconds → *.voicecut 90*`
            );
        }

        // =================================================
        // MAXIMUM 1 HOUR
        // =================================================

        if (cutSeconds > 3600) {

            return reply(
                "❌ Maximum cut time is *1 hour*."
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
        // FILE PATHS
        // =================================================

        const id =
            `${Date.now()}_${Math.floor(Math.random() * 9999)}`;

        inputPath =
            path.join(
                __dirname,
                `voicecut_${id}.input`
            );

        outputPath =
            path.join(
                __dirname,
                `voicecut_${id}.ogg`
            );

        console.log(
            "[VOICECUT] Input:",
            inputPath
        );

        console.log(
            "[VOICECUT] Output:",
            outputPath
        );

        // =================================================
        // DOWNLOAD QUOTED AUDIO
        // =================================================

        let mediaBuffer = null;

        // Method 1
        if (
            typeof quoted.download === "function"
        ) {

            console.log(
                "[VOICECUT] Using quoted.download()"
            );

            mediaBuffer =
                await quoted.download();
        }

        // Method 2
        else if (
            typeof conn.downloadMediaMessage === "function"
        ) {

            console.log(
                "[VOICECUT] Using conn.downloadMediaMessage()"
            );

            mediaBuffer =
                await conn.downloadMediaMessage(
                    quoted
                );
        }

        // =================================================
        // CHECK DOWNLOAD
        // =================================================

        if (!mediaBuffer) {

            throw new Error(
                "Unable to download quoted audio. Your bot framework does not provide a supported media download method."
            );
        }

        if (
            !Buffer.isBuffer(mediaBuffer)
        ) {

            mediaBuffer =
                Buffer.from(
                    mediaBuffer
                );
        }

        if (
            mediaBuffer.length === 0
        ) {

            throw new Error(
                "Downloaded audio is empty."
            );
        }

        console.log(
            "[VOICECUT] Downloaded:",
            mediaBuffer.length,
            "bytes"
        );

        // =================================================
        // SAVE ORIGINAL AUDIO
        // =================================================

        fs.writeFileSync(
            inputPath,
            mediaBuffer
        );

        // =================================================
        // FFMPEG CUT
        // =================================================

        await new Promise(
            (resolve, reject) => {

                let finished = false;

                const fail = (error) => {

                    if (finished)
                        return;

                    finished = true;

                    reject(error);
                };

                const done = () => {

                    if (finished)
                        return;

                    finished = true;

                    resolve();
                };

                ffmpeg(inputPath)

                    // Start from beginning
                    .setStartTime(0)

                    // Cut duration
                    .setDuration(cutSeconds)

                    // WhatsApp compatible Opus
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
                        commandLine => {

                            console.log(
                                "[VOICECUT] FFmpeg:",
                                commandLine
                            );
                        }
                    )

                    .on(
                        "progress",
                        progress => {

                            console.log(
                                "[VOICECUT] Progress:",
                                progress.percent
                            );
                        }
                    )

                    .on(
                        "end",
                        done
                    )

                    .on(
                        "error",
                        error => {

                            console.error(
                                "[VOICECUT] FFmpeg ERROR:",
                                error
                            );

                            fail(error);
                        }
                    )

                    .save(outputPath);
            }
        );

        // =================================================
        // CHECK OUTPUT
        // =================================================

        if (
            !fs.existsSync(outputPath)
        ) {

            throw new Error(
                "FFmpeg finished but output file was not created."
            );
        }

        const outputStats =
            fs.statSync(outputPath);

        if (
            outputStats.size === 0
        ) {

            throw new Error(
                "FFmpeg created an empty output file."
            );
        }

        console.log(
            "[VOICECUT] Output size:",
            outputStats.size
        );

        // =================================================
        // READ OUTPUT
        // =================================================

        const voiceBuffer =
            fs.readFileSync(
                outputPath
            );

        // =================================================
        // SEND WHATSAPP VOICE NOTE
        // =================================================

        await conn.sendMessage(
            from,
            {
                audio:
                    voiceBuffer,

                mimetype:
                    "audio/ogg; codecs=opus",

                ptt: true
            },
            {
                quoted: m
            }
        );

        // =================================================
        // SUCCESS REACTION
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
            `[VOICECUT] Successfully cut ${formatTime(cutSeconds)}`
        );

    } catch (error) {

        // =================================================
        // FULL ERROR LOG
        // =================================================

        console.error(
            "================================="
        );

        console.error(
            "VOICECUT ERROR"
        );

        console.error(
            error
        );

        console.error(
            error?.stack
        );

        console.error(
            "================================="
        );

        // =================================================
        // SEND ERROR
        // =================================================

        try {

            await conn.sendMessage(
                from,
                {
                    text:
                        `❌ *Voice cut failed!*

🔴 *Error:*
${error?.message || error}

Please try again.`
                },
                {
                    quoted: m
                }
            );

        } catch (sendError) {

            console.error(
                "Error sending error message:",
                sendError
            );
        }

    } finally {

        // =================================================
        // DELETE INPUT
        // =================================================

        try {

            if (
                inputPath &&
                fs.existsSync(inputPath)
            ) {

                fs.unlinkSync(
                    inputPath
                );
            }

        } catch (error) {

            console.error(
                "Input cleanup error:",
                error.message
            );
        }

        // =================================================
        // DELETE OUTPUT
        // =================================================

        try {

            if (
                outputPath &&
                fs.existsSync(outputPath)
            ) {

                fs.unlinkSync(
                    outputPath
                );
            }

        } catch (error) {

            console.error(
                "Output cleanup error:",
                error.message
            );
        }
    }
});
