const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// =====================================================
// PARSE TIME
// Supports:
// 90
// 1:20
// 2:30
// 1:02:15
// =====================================================

function parseTime(time) {

    if (!time)
        return null;

    time = String(time).trim();

    // Seconds only
    if (/^\d+$/.test(time)) {
        return Number(time);
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

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;

    if (hours > 0) {

        return (
            `${hours}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(secs).padStart(2, "0")}`
        );
    }

    return (
        `${minutes}:` +
        `${String(secs).padStart(2, "0")}`
    );
}


// =====================================================
// VOICE CUT
// =====================================================

cmd({
    pattern: "voicecut",
    alias: ["vcut", "cutvoice"],
    desc: "Cut audio/voice from beginning",
    category: "tools",
    filename: __filename,
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
                `❌ *Please reply to a voice/audio message.*

Example:
*.voicecut 1:20*`
            );
        }


        // =================================================
        // CHECK TIME
        // =================================================

        const duration =
            parseTime(q);

        if (!duration || duration <= 0) {

            return reply(
                `❌ *Invalid time format!*

Use:

*.voicecut 1:20*

or

*.voicecut 90*

Examples:
• 30 seconds → *.voicecut 0:30*
• 1 minute 20 seconds → *.voicecut 1:20*
• 2 minutes → *.voicecut 2:00*`
            );
        }


        // =================================================
        // MAXIMUM LIMIT
        // =================================================

        if (duration > 3600) {

            return reply(
                "❌ Maximum cut duration is *1 hour*."
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
        // TEMP FILE NAMES
        // =================================================

        const timestamp =
            Date.now();

        inputPath =
            path.join(
                __dirname,
                `voicecut_input_${timestamp}`
            );

        outputPath =
            path.join(
                __dirname,
                `voicecut_output_${timestamp}.ogg`
            );


        // =================================================
        // DOWNLOAD QUOTED AUDIO
        // =================================================

        const buffer =
            await quoted.download();

        if (!buffer) {

            return reply(
                "❌ Unable to download the audio."
            );
        }


        // =================================================
        // SAVE INPUT
        // =================================================

        fs.writeFileSync(
            inputPath,
            buffer
        );


        // =================================================
        // FFMPEG CUT
        // =================================================

        await new Promise(
            (resolve, reject) => {

                ffmpeg(inputPath)

                    /*
                     * Start from beginning
                     */

                    .setStartTime(0)

                    /*
                     * Cut duration
                     */

                    .setDuration(duration)

                    /*
                     * WhatsApp compatible Opus
                     */

                    .audioCodec("libopus")

                    .audioChannels(1)

                    .audioFrequency(48000)

                    .audioBitrate("64k")

                    .format("ogg")

                    .on(
                        "start",
                        commandLine => {

                            console.log(
                                "VoiceCut FFmpeg:",
                                commandLine
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
                "FFmpeg output not found"
            );
        }


        const outputBuffer =
            fs.readFileSync(
                outputPath
            );


        // =================================================
        // SEND VOICE NOTE
        // =================================================

        await conn.sendMessage(
            from,
            {
                audio:
                    outputBuffer,

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


    } catch (error) {

        console.error(
            "VOICECUT ERROR:",
            error
        );

        await reply(
            "❌ *Voice cut failed!*\n\n" +
            "Make sure FFmpeg is installed and try again."
        );

    } finally {

        // =================================================
        // DELETE TEMP FILES
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

        } catch (e) {

            console.log(
                "Input cleanup error:",
                e.message
            );
        }


        try {

            if (
                outputPath &&
                fs.existsSync(outputPath)
            ) {

                fs.unlinkSync(
                    outputPath
                );
            }

        } catch (e) {

            console.log(
                "Output cleanup error:",
                e.message
            );
        }
    }
});
