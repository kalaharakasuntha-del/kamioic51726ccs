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
    const mp3Path = path.join(__dirname, `cut_${timestamp}.mp3`);
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
            return reply("⚠️ Please reply to an Audio or Voice Note to use this command.\n\n*Examples:*\n• `.vcut 0:03 - 1:30` (From 3s to 1m 30s)\n• `.voicecut 0:30` (From start to 30s)");
        }

        /* =====================================================
                     2. PARSE TIME PARAMETERS
        ===================================================== */
        let rawQuery = q ? q.trim() : "";
        if (!rawQuery) {
            return reply("⚠️ Please specify the time duration to cut.\n\n*Examples:*\n• `.vcut 0:03 - 1:30`\n• `.voicecut 0:30` (From start to 0:30)");
        }

        let startTime = 0;
        let duration = 0;

        // Parse inputs separated by '-' or spaces
        let parts = rawQuery.includes("-") 
            ? rawQuery.split("-").map(s => s.trim()) 
            : rawQuery.split(/\s+/);

        if (parts.length === 1) {
            // .vcut 0:30 (Cut from 0:00 to 0:30)
            const endTimeSec = parseTimeToSeconds(parts[0]);
            if (endTimeSec === null || endTimeSec <= 0) {
                return reply("❌ Invalid time format! Example: `0:30` or `80` seconds.");
            }
            startTime = 0;
            duration = endTimeSec;
        } else if (parts.length >= 2) {
            // .vcut 0:03 - 1:30 or .vcut 0:03 1:30
            const startSec = parseTimeToSeconds(parts[0]);
            const endSec = parseTimeToSeconds(parts[1]);

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
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
        if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath);
    }
});
