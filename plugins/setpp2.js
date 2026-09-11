const { cmd } = require("../command");

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

        const imageMessage =
            quoted.message?.imageMessage ||
            quoted.msg?.imageMessage ||
            quoted.imageMessage ||
            quoted;

        if (!imageMessage) {
            return reply("❌ Please reply to an image.");
        }

        const media = await conn.downloadMediaMessage(quoted);

        if (!media) {
            return reply("❌ Failed to download the image.");
        }

        await conn.updateProfilePicture(
            conn.user.id,
            media
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
