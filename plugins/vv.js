
const { cmd } = require("../command");

cmd({
  pattern: "vv",
  alias: ["retrive", "💗"],
  react: "🫟",
  desc: "Owner Only - Retrieve ordinary quoted media",
  category: "owner",
  filename: __filename
}, async (client, message, match, { from, isCreator }) => {
  try {
    if (!isCreator) {
      return await client.sendMessage(from, {
        text: "🚫 Owner Only Command!"
      }, { quoted: message });
    }

    const quoted = match.quoted;

    if (!quoted) {
      return await client.sendMessage(from, {
        text: "🍁 Please reply to an ordinary media message!"
      }, { quoted: message });
    }

    const mtype = quoted.mtype;

    if (!["imageMessage", "videoMessage", "audioMessage"].includes(mtype)) {
      return await client.sendMessage(from, {
        text: "❌ Only image, video and audio are supported."
      }, { quoted: message });
    }

    if (quoted.viewOnce || quoted.msg?.viewOnce) {
      return await client.sendMessage(from, {
        text: "⚠️ View Once media is not supported."
      }, { quoted: message });
    }

    if (typeof quoted.download !== "function") {
      throw new Error("Download method is unavailable in this message wrapper.");
    }

    const buffer = await quoted.download();

    if (!buffer || !buffer.length) {
      throw new Error("Downloaded media is empty.");
    }

    let content;

    switch (mtype) {
      case "imageMessage":
        content = {
          image: buffer,
          caption: quoted.text || "",
          mimetype: quoted.mimetype || "image/jpeg"
        };
        break;

      case "videoMessage":
        content = {
          video: buffer,
          caption: quoted.text || "",
          mimetype: quoted.mimetype || "video/mp4"
        };
        break;

      case "audioMessage":
        content = {
          audio: buffer,
          mimetype: quoted.mimetype || "audio/mp4",
          ptt: quoted.ptt || false
        };
        break;
    }

    await client.sendMessage(from, content, {
      quoted: message
    });

  } catch (error) {
    console.error("VV Error:", error);

    await client.sendMessage(from, {
      text: "❌ Media Error:\n" + error.message
    }, { quoted: message });
  }
});
