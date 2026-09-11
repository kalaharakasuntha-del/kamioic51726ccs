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

        // Download image
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
            return reply(
                "❌ This URL is not a direct image URL."
            );
        }

        const input = Buffer.from(response.data);

        if (!input.length) {
            return reply(
                "❌ Image download failed."
            );
        }

        await reply("🖼️ Processing image...");

        // Read image using Jimp v1.x
        const image = await Jimp.read(input);

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        if (!width || !height) {
            return reply(
                "❌ Invalid image dimensions."
            );
        }

        /*
         * Create square size
         */
        const size = Math.max(width, height);

        /*
         * -----------------------------
         * BLURRED BACKGROUND
         * -----------------------------
         */

        const background = image.clone();

        // Cover square area
        background.cover({
            w: size,
            h: size
        });

        // Strong blur
        background.blur(30);

        /*
         * -----------------------------
         * FINAL CANVAS
         * -----------------------------
         */

        const finalImage = new Jimp({
            width: size,
            height: size
        });

        // Put blurred background
        finalImage.composite(
            background,
            0,
            0
        );

        /*
         * -----------------------------
         * ORIGINAL IMAGE
         * -----------------------------
         */

        const x = Math.floor(
            (size - width) / 2
        );

        const y = Math.floor(
            (size - height) / 2
        );

        finalImage.composite(
            image,
            x,
            y
        );

        /*
         * -----------------------------
         * FINAL RESIZE
         * -----------------------------
         */

        finalImage.resize({
            w: 640,
            h: 640
        });

        /*
         * -----------------------------
         * JPEG BUFFER
         * -----------------------------
         */

        const buffer = await finalImage.getBuffer(
            "image/jpeg"
        );

        await reply(
            "⏳ Updating profile picture..."
        );

        /*
         * -----------------------------
         * SET PROFILE PICTURE
         * -----------------------------
         */

        await conn.updateProfilePicture(
            conn.user.id,
            buffer
        );

        return reply(
            "✅ Profile picture updated successfully! 🖼️"
        );

    } catch (error) {

        console.error(
            "SET PP ERROR:",
            error
        );

        return reply(
            "❌ Error updating profile picture.\n\n" +
            `Error: ${error.message}`
        );
    }
});
