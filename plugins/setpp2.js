const { cmd } = require("../command");
const axios = require("axios");
const Jimp = require("jimp");

cmd({
    pattern: "setpp",
    desc: "Set bot profile picture using image URL",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {

    if (!isOwner) {
        return reply("❌ You are not the owner!");
    }

    const url = args[0];

    if (!url) {
        return reply(
            "❌ Please provide an image URL.\n\n" +
            "Example:\n" +
            ".setpp https://example.com/image.jpg"
        );
    }

    if (!/^https?:\/\/.+/i.test(url)) {
        return reply("❌ Invalid URL!");
    }

    try {

        await reply("⏳ Downloading image...");

        const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const contentType =
            response.headers["content-type"] || "";

        if (!contentType.startsWith("image/")) {
            return reply("❌ URL එක direct image URL එකක් නෙවෙයි.");
        }

        const input = Buffer.from(response.data);

        if (!input.length) {
            return reply("❌ Image download failed.");
        }

        await reply("🖼️ Processing image...");

        const image = await Jimp.read(input);

        /*
         * Any image size / aspect ratio accepted.
         * No cropping.
         */

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        const size = Math.max(width, height);

        // Transparent canvas
        const canvas = new Jimp(size, size, 0x00000000);

        // Center original image
        const x = Math.floor((size - width) / 2);
        const y = Math.floor((size - height) / 2);

        canvas.composite(image, x, y);

        // Resize final profile picture
        canvas.resize(640, 640);

        const buffer = await canvas.getBufferAsync(
            Jimp.MIME_JPEG
        );

        await conn.updateProfilePicture(
            conn.user.id,
            buffer
        );

        return reply(
            "✅ Profile picture updated successfully! 🖼️"
        );

    } catch (error) {

        console.error("SET PP ERROR:", error);

        return reply(
            "❌ Error updating profile picture.\n\n" +
            error.message
        );
    }
});
