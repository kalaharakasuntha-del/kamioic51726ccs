const { cmd } = require("../command");
const FormData = require("form-data");
const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Jimp } = require("jimp");

// Dynamic fetch
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

cmd({
    pattern: "setfullpp",
    alias: ["setfullprofile", "addfullpp"],
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

        // =====================================================
        // GET QUOTED MESSAGE
        // =====================================================

        let msg =
            mek.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            mek.message;

        // =====================================================
        // VIEW ONCE FIX
        // =====================================================

        if (msg?.viewOnceMessageV2) {
            msg = msg.viewOnceMessageV2.message;
        } else if (msg?.viewOnceMessageV2Extension) {
            msg = msg.viewOnceMessageV2Extension.message;
        } else if (msg?.viewOnceMessage) {
            msg = msg.viewOnceMessage.message;
        }

        // =====================================================
        // FIND IMAGE
        // =====================================================

        const type = Object.keys(msg || {}).find(k =>
            ["imageMessage"].includes(k)
        );

        if (!type) {
            return reply(
                "❌ Please reply to an image!"
            );
        }

        // React
        await conn.sendMessage(from, {
            react: {
                text: "⬆️",
                key: mek.key
            }
        });

        const target = msg[type];

        let mime = target.mimetype || "image/jpeg";

        // =====================================================
        // DOWNLOAD IMAGE
        // =====================================================

        await reply("⏳ Uploading image...");

        const stream = await downloadContentFromMessage(
            target,
            "image"
        );

        let buffer = Buffer.from([]);

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

        // =====================================================
        // UPLOAD TO YOUR WHITESHADOW UPLOADER
        // =====================================================

        const form = new FormData();

        form.append("file", buffer, {
            filename: "setpp.jpg",
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

        if (
            !json.status ||
            !json.result?.url
        ) {
            console.log("Uploader response:", json);

            return reply(
                "❌ Image upload failed!"
            );
        }

        const imageUrl = json.result.url;

        console.log(
            "Uploaded Image URL:",
            imageUrl
        );

        // =====================================================
        // DOWNLOAD IMAGE FROM UPLOADED URL
        // =====================================================

        await reply("🖼️ Processing profile picture...");

        const imageResponse = await axios.get(
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

        const inputBuffer = Buffer.from(
            imageResponse.data
        );

        // =====================================================
        // JIMP PROCESSING
        // =====================================================

        const image = await Jimp.read(
            inputBuffer
        );

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        if (!width || !height) {
            return reply(
                "❌ Invalid image!"
            );
        }

        // Square size
        const size = Math.max(
            width,
            height
        );

        // =====================================================
        // BLURRED BACKGROUND
        // =====================================================

        const background = image.clone();

        background.cover({
            w: size,
            h: size
        });

        background.blur(30);

        // =====================================================
        // FINAL CANVAS
        // =====================================================

        const finalImage = new Jimp({
            width: size,
            height: size
        });

        // Add blurred background
        finalImage.composite(
            background,
            0,
            0
        );

        // =====================================================
        // ADD ORIGINAL IMAGE
        // =====================================================

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

        // =====================================================
        // RESIZE
        // =====================================================

        finalImage.resize({
            w: 640,
            h: 640
        });

        // =====================================================
        // JPEG BUFFER
        // =====================================================

        const finalBuffer =
            await finalImage.getBuffer(
                "image/jpeg"
            );

        // =====================================================
        // UPDATE WHATSAPP PROFILE PICTURE
        // =====================================================

        await conn.updateProfilePicture(
            conn.user.id,
            finalBuffer
        );

        // Done reaction
        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

        // =====================================================
        // SUCCESS MESSAGE
        // =====================================================

        return reply(
            `╭━━〔 🖼️ *SET FULL PROFILE* 〕━━╮
┃
┃ ✅ Profile picture updated!
┃
┃ ☁️ Uploaded successfully
┃ 🔗 ${imageUrl}
┃
╰━━━━━━━━━━━━━━━━━━━━╯

> © 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`
        );

    } catch (error) {

        console.error(
            "SETPP ERROR:",
            error
        );

        return reply(
            "❌ Error updating profile picture.\n\n" +
            `Error: ${error.message}`
        );
    }
});
