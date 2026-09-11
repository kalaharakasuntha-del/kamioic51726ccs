const { cmd } = require("../command");
const Jimp = require("jimp");

cmd({
    pattern: "setpp2",
    desc: "Set bot profile picture.",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, quoted, reply }) => {

    if (!isOwner) return reply("❌ You are not the owner!");

    if (!quoted) {
        return reply("❌ Please reply to an image.");
    }

    try {

        const media = await conn.downloadMediaMessage(quoted);

        if (!media) {
            return reply("❌ Failed to download the image.");
        }

        const image = await Jimp.read(media);

        image.cover(640, 640);

        const buffer = await image.getBufferAsync(
            Jimp.MIME_JPEG
        );

        await conn.updateProfilePicture(
            conn.user.id,
            buffer
        );

        return reply(
            "🖼️ Profile picture updated successfully!"
        );

    } catch (error) {

        console.error("SetPP Error:", error);

        return reply(
            `❌ Error updating profile picture: ${error.message}`
        );
    }
});
