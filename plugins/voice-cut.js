const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

/**
 * Converts formatted time (HH:MM:SS / MM:SS / SS) into seconds
 */
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;
    
    // Direct number input (e.g., 80 -> 80 seconds)
    if (/^\d+(\.\d+)?$/.test(timeStr)) {
        return parseFloat(timeStr);
    }

    // HH:MM:SS or MM:SS format
    const parts = timeStr.split(":").map(Number);
    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
        // MM:SS -> Minutes * 60 + Seconds
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // HH:MM:SS -> Hours * 3600 + Minutes * 60 + Seconds
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return null;
}

cmd({
    pattern: "voicecut",
    alias: ["cutvoice", "audiocut", "vcut"],
    desc: "Cut audio/voice note and send as a voice note",
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
            return reply("⚠️ Please reply to an Audio or Voice Note to use this command.\n\n*Examples:*\n• `.voicecut 1:20` (From start to 1m 20s)\n• `.voicecut 0:30 1:30` (From 30s to 1m 30s)");
        }

        /* =====================================================
                     2. PARSE TIME PARAMETERS
        ===================================================== */
        const args = q ? q.trim().split(/\s+/) : [];
        if (args.length === 0) {
            return reply("⚠️ Please specify the time duration to cut.\n\n*Examples:*\n• `.voicecut 1:20` (From start to 1:20)\n• `.voicecut 0:10 0:50` (From 0:10 to 0:50)");
        }

        let startTime = 0;
        let duration = 0;

        if (args.length === 1) {
            // .voicecut 1:20 (Cut from 0 to 1:20)
            const endTimeSec = parseTimeToSeconds(args[0]);
            if (endTimeSec === null || endTimeSec <= 0) {
                return reply("❌ Invalid time format! Use `1:20` or `80` seconds.");
            }
            startTime = 0;
            duration = endTimeSec;
        } else if (args.length >= 2) {
            // .voicecut 0:30 1:30 (Cut from start time to end time)
            const startSec = parseTimeToSeconds(args[0]);
            const endSec = parseTimeToSeconds(args[1]);

            if (startSec === null || endSec === null || endSec <= startSec) {
                return reply("❌ Invalid time format! End time must be greater than start time.");
            }
            startTime = startSec;
            duration = endSec - startSec;
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
                     4. CUT AUDIO USING FFMPEG
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
                     5. SEND VOICE NOTE (PTT)
        ===================================================== */
        await conn.sendMessage(from, { react: { text: "⬆️", key: m.key } });

        await conn.sendMessage(
            from,
            {
                audio: fs.readFileSync(opusPath),
                mimetype: "audio/ogg; codecs=opus",
                ptt: true // Send as Voice Note (PTT)
            },
            { quoted: m }
        );

        await conn.sendMessage(from, { react: { text: "✔️", key: m.key } });

    } catch (error) {
        console.error("Voice Cut Command Error:", error);
        return reply("❌ An error occurred while cutting the audio. Please try again.");
    } finally {
        /* =====================================================
                     6. CLEANUP TEMP FILES
        ===================================================== */
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath);
    }
});
