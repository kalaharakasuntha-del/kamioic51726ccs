const { cmd } = require("../command");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// dynamic fetch
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

cmd({
    pattern: "url2",
    alias: ["tourl2", "upload2"],
    desc: "Upload media & get URL",
    category: "tools",
    react: "🖇️",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        let msg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || mek.message;

        // view once fix
        if (msg?.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
        else if (msg?.viewOnceMessageV2Extension) msg = msg.viewOnceMessageV2Extension.message;
        else if (msg?.viewOnceMessage) msg = msg.viewOnceMessage.message;

        const type = Object.keys(msg || {}).find(k =>
            ["imageMessage", "videoMessage", "stickerMessage", "documentMessage"].includes(k)
        );

        if (!type) {
            return reply("*Reply to an Image/Video/Document/Sticker!*");
        }

        // react
        await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });

        const target = msg[type];
        let mime = target.mimetype || "";

        // extension fix
        let ext = mime.split("/")[1]?.split(";")[0] || "bin";
        if (ext === "jpeg") ext = "jpg";
        if (mime.includes("quicktime")) ext = "mov";

        if (type === "stickerMessage") {
            ext = "webp";
            mime = "image/webp";
        }

        // download type
        let dlType = "document";
        if (type === "imageMessage") dlType = "image";
        else if (type === "videoMessage") dlType = "video";
        else if (type === "stickerMessage") dlType = "sticker";

        // download buffer
        const stream = await downloadContentFromMessage(target, dlType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // upload
        const form = new FormData();
        form.append("file", buffer, {
            filename: `upload.${ext}`,
            contentType: mime
        });

        const res = await fetch("https://whiteshadow-uploader.vercel.app/api/upload", {
            method: "POST",
            body: form,
            headers: form.getHeaders()
        });

        const json = await res.json();

        if (!json.status || !json.result?.url) {
            return reply("❌ Upload Failed!");
        }

        const url = json.result.url;
        const size = (buffer.length / 1024 / 1024).toFixed(2);

        const caption = `╭━━━━〔 ☁️ *VIP UPLOADER* 〕━━━━━╮
┃ 📄 File: upload.${ext}
┃ ⚖️ Size: ${size} MB
┃ 🔗 URL: ${url}
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

> © Powerd by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

        // ✅ reply to user message
        await conn.sendMessage(from, {
            text: caption
        }, {
            quoted: mek
        });

        // done react
        await conn.sendMessage(from, { react: { text: "✔️", key: mek.key } });

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});
