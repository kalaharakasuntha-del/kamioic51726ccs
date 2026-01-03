const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

cmd({
    pattern: 'getvideonote',
    desc: 'Send any video URL as a video note',
    sucReact: '🎬',
    category: ['download', 'utility'],
    async handler(m, conn) {
        let text = m.text || '';
        let args = text.trim().split(' ');
        let videoUrl = args[1];

        if (!videoUrl) {
            return conn.sendMessage(
                m.from,
                { text: '❌ Please provide a video URL!\nExample: .getvideonote https://example.com/video.mp4' },
                { quoted: m }
            );
        }

        // Temporary file path
        const tempFile = path.join(__dirname, `temp_${Date.now()}.mp4`);

        try {
            // Download video
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempFile);
            response.data.pipe(writer);

            // Wait for download to finish
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Send as video note
            await conn.sendMessage(
                m.from,
                {
                    video: fs.readFileSync(tempFile),
                    mimetype: 'video/mp4',
                    ptv: true
                },
                { quoted: m }
            );

            // Delete temp file
            fs.unlinkSync(tempFile);

        } catch (err) {
            console.error(err);
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

            await conn.sendMessage(
                m.from,
                { text: '❌ Failed to send video note. Check the URL or try again.' },
                { quoted: m }
            );
        }
    }
});
