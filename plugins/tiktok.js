const axios = require("axios");
const { cmd } = require("../command");

cmd(
  {
    pattern: "tiktok",
    alias: ["tt"],
    react: "🎬",
    desc: "Download TikTok videos (Unlimited replies)",
    category: "download",
    filename: __filename,
  },

  async (conn, mek, m, { from, q, reply }) => {
    try {
// URL get (text or reply)
let url = q;

if (!url && quoted) {
  url = quoted.text || quoted.caption || "";
}

if (!url || !url.startsWith("http")) {
  return reply("❌ Valid TikTok URL ekak denna.");
}

// ⏳ react
await conn.sendMessage(from, {
  react: { text: "⏳", key: mek.key },
});

      const { data } = await axios.get(
        `https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${encodeURIComponent(
          q
        )}`
      );

      if (!data?.status) {
        return reply("⚠️ TikTok data ganna ba.");
      }

      const dat = data.data;

      const caption = `
*🍇 RANUMITHA-X-MD TIKTOK DOWNLOADER 🍇*

📖 \`Title:\` ${dat.title || "No title"}
⏱️ \`Duration:\` ${dat.duration || "N/A"}
👍 \`Likes:\` ${dat.view || "0"} 
💬 \`Comments:\` ${dat.comment || "0"}
🔁 \`Shares:\` ${dat.share || "0"}
🔗 \`Link:\` ${tiktokUrl}

💬 *Reply with your choice:*

1️⃣ No Watermark 🎟️
2️⃣ With Watermark 🎫
3️⃣ Audio Only 🎶

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

      const sentMsg = await conn.sendMessage(
        from,
        { image: { url: dat.thumbnail }, caption },
        { quoted: mek }
      );

      const menuMsgId = sentMsg.key.id;

      // 🔁 UNLIMITED reply listener
      conn.ev.on("messages.upsert", async (update) => {
        try {
          const msg = update.messages[0];
          if (!msg?.message) return;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

          const repliedId =
            msg.message.extendedTextMessage?.contextInfo?.stanzaId;

          // ❗ Only replies to this menu
          if (repliedId !== menuMsgId) return;

          const choice = text?.trim();
          if (!["1", "2", "3"].includes(choice)) return;

          // ⬇️ react
          await conn.sendMessage(from, {
            react: { text: "⬇️", key: msg.key },
          });

          let sendType;

          if (choice === "1") {
            sendType = {
              video: { url: dat.video },
              caption: "📥 HD Video",
            };
          }

          if (choice === "2") {
            sendType = {
              video: { url: dat.sd_video || dat.video },
              caption: "📥 SD Video",
            };
          }

          if (choice === "3") {
            sendType = {
              audio: { url: dat.audio },
              mimetype: "audio/mpeg",
              ptt: false,
            };
          }

          // ⬆️ react
          await conn.sendMessage(from, {
            react: { text: "⬆️", key: msg.key },
          });

          await conn.sendMessage(from, sendType, { quoted: msg });

          // ✔️ react
          await conn.sendMessage(from, {
            react: { text: "✔️", key: msg.key },
          });
        } catch (e) {
          console.error("Unlimited reply error:", e);
        }
      });
    } catch (err) {
      console.error("TikTok cmd error:", err);
      reply("❌ Error occurred.");
    }
  }
);



cmd(
  {
    pattern: "tiktok2",
    alias: ["tt2"],
    react: "🎬",
    desc: "Download TikTok videos (Unlimited reply)",
    category: "download",
    filename: __filename,
  },

  async (conn, mek, m, { from, q, reply }) => {
    try {
      if (!q || !q.startsWith("http")) {
        return reply("❌ Please provide a valid TikTok URL.");
      }

      // ⏳ react
      await conn.sendMessage(from, {
        react: { text: "⏳", key: mek.key },
      });

      // API
      const { data } = await axios.get(
        `https://api.nexoracle.com/downloader/tiktok-nowm?apikey=free_key@maher_apis&url=${encodeURIComponent(
          q
        )}`
      );

      if (!data?.status || !data?.result) {
        return reply("⚠️ Failed to retrieve TikTok media.");
      }

      const result = data.result;
      const { title, url, thumbnail, duration, metrics } = result;

      const caption = `
*🍇 RANUMITHA-X-MD TIKTOK DOWNLOADER 🍇*

📖 \`Title:\` ${title || "No title"}
⏱️ \`Duration:\` ${duration || "N/A"}s
👍 \`Likes:\` ${metrics?.digg_count?.toLocaleString() || "0"}
💬 \`Comments:\` ${metrics?.comment_count?.toLocaleString() || "0"}
🔁 \`Shares:\` ${metrics?.share_count?.toLocaleString() || "0"}
🔗 \`Link:\` ${q}

💬 *Reply with your choice:*

1️⃣ No Watermark 🎟️
2️⃣ With Watermark 🎫
3️⃣ Audio Only 🎶

> © Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

      const sentMsg = await conn.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption,
        },
        { quoted: mek }
      );

      const menuMsgId = sentMsg.key.id;

      // 🔁 Unlimited reply listener
      conn.ev.on("messages.upsert", async (update) => {
        try {
          const msg = update.messages[0];
          if (!msg?.message) return;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

          const repliedId =
            msg.message.extendedTextMessage?.contextInfo?.stanzaId;

          // ❗ only replies to this menu
          if (repliedId !== menuMsgId) return;

          const choice = text?.trim();
          if (!["1", "2", "3"].includes(choice)) return;

          // ⬇️ react
          await conn.sendMessage(from, {
            react: { text: "⬇️", key: msg.key },
          });

          let sendType;

          if (choice === "1") {
            // HD
            sendType = {
              video: { url },
              caption: "📥 *Downloaded HD Quality*",
            };
          }

          if (choice === "2") {
            // SD (API limitation → same URL)
            sendType = {
              video: { url },
              caption: "📥 *Downloaded Available Quality*",
            };
          }

          if (choice === "3") {
            // Audio
            sendType = {
              audio: { url },
              mimetype: "audio/mp4",
              ptt: false,
            };
          }

          // ⬆️ react
          await conn.sendMessage(from, {
            react: { text: "⬆️", key: msg.key },
          });

          await conn.sendMessage(from, sendType, { quoted: msg });

          // ✔️ react
          await conn.sendMessage(from, {
            react: { text: "✔️", key: msg.key },
          });
        } catch (e) {
          console.error("TT2 reply error:", e);
        }
      });
    } catch (error) {
      console.error("TikTok2 Plugin Error:", error);
      reply("❌ An error occurred. Try again later.");
    }
  }
);
