const { cmd } = require("../command");
const axios = require("axios");
const { Jimp } = require("jimp");

cmd({
    pattern: "setpp2",
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

        if (!contentType.toLowerCase().startsWith("image/")) {
            return reply("❌ This URL is not a direct image URL.");
        }

        const input = Buffer.from(response.data);

        if (!input.length) {
            return reply("❌ Image download failed.");
        }

        await reply("🖼️ Processing image...");

        // Jimp v1.x
        const image = await Jimp.read(input);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // Keep the complete image
        const size = Math.max(width, height);

        // White square canvas
        const canvas = new Jimp({
            width: size,
            height: size,
            color: 0xFFFFFFFF
        });

        const x = Math.floor((size - width) / 2);
        const y = Math.floor((size - height) / 2);

        canvas.composite(image, x, y);

        // Final profile picture size
        canvas.resize({
            w: 640,
            h: 640
        });

        const buffer = await canvas.getBuffer(
            "image/jpeg"
        );

        await reply("⏳ Updating profile picture...");

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
            `${error.message}`
        );
    }
});
