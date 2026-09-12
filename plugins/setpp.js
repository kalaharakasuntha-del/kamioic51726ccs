const { cmd } = require("../command");
const FormData = require("form-data");
const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// Dynamic fetch
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

cmd({
    pattern: "setpp",
    alias: ["setprofile", "setdp"],
    desc: "Set bot profile picture from replied image",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {

    if (!isOwner) {
        return reply("*❌ You are not the owner!*");
    }

    try {

        // ==========================================
        // GET REPLIED MESSAGE
        // ==========================================

        let msg =
            mek.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            mek.message;

        // ==========================================
        // VIEW ONCE FIX
        // ==========================================

        if (msg?.viewOnceMessageV2) {
            msg = msg.viewOnceMessageV2.message;
        }
        else if (msg?.viewOnceMessageV2Extension) {
            msg = msg.viewOnceMessageV2Extension.message;
        }
        else if (msg?.viewOnceMessage) {
            msg = msg.viewOnceMessage.message;
        }

        // ==========================================
        // CHECK IMAGE
        // ==========================================

        const type = Object.keys(msg || {}).find(k =>
            k === "imageMessage"
        );

        if (!type) {
            return reply(
                "❌ Please reply to an image!"
            );
        }

        // Upload reaction
        await conn.sendMessage(from, {
            react: {
                text: "⬆️",
                key: mek.key
            }
        });

        const target = msg[type];

        const mime =
            target.mimetype || "image/jpeg";

        // ==========================================
        // DOWNLOAD ORIGINAL WHATSAPP IMAGE
        // ==========================================

        const stream = await downloadContentFromMessage(
            target,
            "image"
        );

        let buffer = Buffer.alloc(0);

        for await (const chunk of stream) {
            buffer = Buffer.concat([
                buffer,
                chunk
            ]);
        }

        if (!buffer.length) {
            return reply(
                "❌ Failed to download image!"
            );
        }

        // ==========================================
        // UPLOAD TO YOUR WHITESHADOW UPLOADER
        // ==========================================

        await reply(
            "⏳ Uploading image..."
        );

        const form = new FormData();

        form.append("file", buffer, {
            filename: "profile.jpg",
            contentType: mime
        });

        const uploadResponse = await fetch(
            "https://whiteshadow-uploader.vercel.app/api/upload",
            {
                method: "POST",
                body: form,
                headers: form.getHeaders()
            }
        );

        const json = await uploadResponse.json();

        console.log(
            "Uploader Response:",
            json
        );

        if (
            !json.status ||
            !json.result?.url
        ) {
            return reply(
                "❌ Image upload failed!"
            );
        }

        // ==========================================
        // GET UPLOADED IMAGE URL
        // ==========================================

        const imageUrl =
            json.result.url;

        console.log(
            "Profile Image URL:",
            imageUrl
        );

        // ==========================================
        // DOWNLOAD IMAGE FROM URL
        // ==========================================

        await reply(
            "🖼️ Setting profile picture..."
        );

        const response = await axios.get(
            imageUrl,
            {
                responseType: "arraybuffer",
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        // ==========================================
        // ORIGINAL IMAGE BUFFER
        // ==========================================

        const profileBuffer =
            Buffer.from(response.data);

        if (!profileBuffer.length) {
            return reply(
                "❌ Failed to download uploaded image!"
            );
        }

        // ==========================================
        // SET WHATSAPP PROFILE PICTURE
        // NO RESIZE
        // NO CROP
        // NO JIMP
        // ==========================================

        await conn.updateProfilePicture(
            conn.user.id,
            profileBuffer
        );

        // ==========================================
        // SUCCESS REACTION
        // ==========================================

        await conn.sendMessage(from, {
            react: {
                text: "✔️",
                key: mek.key
            }
        });

        // ==========================================
        // SUCCESS MESSAGE
        // ==========================================

        return reply(
            `╭━━〔 🖼️ *SET PROFILE* 〕━━╮
┃
┃ ✅ Profile picture updated!
┃
┃ 📸 Original image preserved
┃ 🔗 ${imageUrl}
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> © Powerd by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`
        );

    } catch (error) {

        console.error(
            "SET PP ERROR:",
            error
        );

        return reply(
            "❌ Failed to update profile picture.\n\n" +
            `Error: ${error.message}`
        );
    }
});
