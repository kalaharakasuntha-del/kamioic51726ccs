const { cmd } = require("../command");
const axios = require("axios");

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

    // URL check
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
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024
        });

        const contentType =
            response.headers["content-type"] || "";

        if (!contentType.startsWith("image/")) {
            return reply("❌ The URL is not a direct image URL.");
        }

        const buffer = Buffer.from(response.data);

        if (!buffer.length) {
            return reply("❌ Image download failed.");
        }

        // Set profile picture
        await conn.updateProfilePicture(
            conn.user.id,
            buffer
        );

        return reply(
            "✅ Bot profile picture updated successfully! 🖼️"
        );

    } catch (error) {

        console.error("SET PP ERROR:", error);

        return reply(
            "❌ Failed to update profile picture.\n\n" +
            `Error: ${error.message}`
        );
    }
});
