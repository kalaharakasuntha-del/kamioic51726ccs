const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

/**
 * Converts formatted time (HH:MM:SS / MM:SS / SS) into seconds
 */
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;

    if (/^\d+(\.\d+)?$/.test(timeStr)) {
        return parseFloat(timeStr);
    }

    const parts = timeStr.split(":").map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
}

/**
 * Get exact total duration of media file in seconds using ffprobe
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata?.format?.duration;
            if (duration) resolve(parseFloat(duration));
            else reject(new Error("Could not determine audio duration"));
        });
    });
}

cmd({
    pattern: "voicecut",
    alias: ["cutvoice", "audiocut", "vcut"],
    desc: "Cut audio/voice note with first/last or custom time ranges",
    category: "audio",
    filename: __filename,
}, async (conn, m, store, { from, quoted, q, reply }) => {

    const timestamp = Date.now();
    const inputPath = path.join(__dirname, `input_${timestamp}.media`);
    const opusPath = path.join(__dirname, `cut_${timestamp}.opus`);

    try {
        /* =====================================================
                     1. VALIDATE QUOTED MESSAGE
        ===================================================== */
        const isAudio = m.quoted && (
            m.quoted.type === "audioMessage" ||
            m.quoted.mtype === "audioMessage" ||
            m.quoted.message?.audioMessage
        );

        if (!isAudio) {
            return reply(
                "⚠️ Please reply to an Audio or Voice Note.\n\n" +
                "*Examples:*\n" +
                "• `.voicecut first 1:30` (First 1 min 30s)\n" +
                "• `.voicecut last 1:30` (Last 1 min 30s)\n" +
                "• `.voicecut 0:30 1:30` (From 30s to 1m 30s)\n" +
                "• `.voicecut 1:20` (From start to 1:20)"
            );
        }

        /* =====================================================
                     2. PARSE COMMAND INPUT
        ===================================================== */
        const args = q ? q.trim().split(/\s+/) : [];
        if (args.length === 0) {
            return reply(
                "⚠️ Please specify how you want to cut the audio.\n\n" +
                "*Examples:*\n" +
                "• `.voicecut first 1:30` (or `f 1:30`)\n" +
                "• `.voicecut last 1:30` (or `l 1:30`)\n" +
                "• `.voicecut 0:10 0:50`"
            );
        }

        // Reaction
        await conn.sendMessage(from, { react: { text: "✂️", key: m.key } });

        /* =====================================================
                     3. DOWNLOAD AUDIO MEDIA
        ===================================================== */
        const mediaBuffer = await m.quoted.download();
        if (!mediaBuffer) {
            return reply("❌ Failed to download audio file.");
        }

        fs.writeFileSync(inputPath, mediaBuffer);

        /* =====================================================
                     4. CALCULATE START & DURATION
        ===================================================== */
        let startTime = 0;
        let duration = 0;

        const mode = args[0].toLowerCase();

        // Mode A: FIRST (e.g. .voicecut first 1:30 or .voicecut f 1:30)
        if (mode === "first" || mode === "f") {
            const timeVal = args[1] ? parseTimeToSeconds(args[1]) : null;
            if (!timeVal || timeVal <= 0) {
                return reply("❌ Invalid time format! Example: `.voicecut first 1:30`");
            }
            startTime = 0;
            duration = timeVal;

        // Mode B: LAST (e.g. .voicecut last 1:30 or .voicecut l 1:30)
        } else if (mode === "last" || mode === "l") {
            const timeVal = args[1] ? parseTimeToSeconds(args[1]) : null;
            if (!timeVal || timeVal <= 0) {
                return reply("❌ Invalid time format! Example: `.voicecut last 1:30`");
            }

            const totalDuration = await getAudioDuration(inputPath);

            if (timeVal >= totalDuration) {
                startTime = 0;
                duration = totalDuration;
            } else {
                startTime = totalDuration - timeVal;
                duration = timeVal;
            }

        // Mode C: START -> END RANGE (e.g. .voicecut 0:30 1:30)
        } else if (args.length >= 2) {
            const startSec = parseTimeToSeconds(args[0]);
            const endSec = parseTimeToSeconds(args[1]);

            if (startSec === null || endSec === null || endSec <= startSec) {
                return reply("❌ Invalid range! End time must be greater than start time.");
            }
            startTime = startSec;
            duration = endSec - startSec;

        // Mode D: SINGLE TIME (e.g. .voicecut 1:30 -> cuts 0:00 to 1:30)
        } else {
            const endTimeSec = parseTimeToSeconds(args[0]);
            if (!endTimeSec || endTimeSec <= 0) {
                return reply("❌ Invalid time format! Example: `.voicecut 1:30` or `.voicecut first 1:30`");
            }
            startTime = 0;
            duration = endTimeSec;
        }

        /* =====================================================
                     5. PROCESS WITH FFMPEG
        ===================================================== */
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .setStartTime(startTime)
                .setDuration(duration)
                .audioCodec("libopus")
                .audioChannels(1)
                .audioFrequency(48000)
                .format("opus")
                .on("end", resolve)
                .on("error", reject)
                .save(opusPath);
        });

        /* =====================================================
                     6. SEND VOICE NOTE (PTT)
        ===================================================== */
        await conn.sendMessage(from, { react: { text: "⬆️", key: m.key } });

        await conn.sendMessage(
            from,
            {
                audio: fs.readFileSync(opusPath),
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
            },
            { quoted: m }
        );

        await conn.sendMessage(from, { react: { text: "✔️", key: m.key } });

    } catch (error) {
        console.error("Voice Cut Error:", error);
        return reply("❌ An error occurred while cutting the audio.");
    } finally {
        /* =====================================================
                     7. CLEANUP TEMP FILES
        ===================================================== */
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath);
    }
});
