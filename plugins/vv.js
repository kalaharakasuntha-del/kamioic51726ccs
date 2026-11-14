
const { cmd } = require("../command");

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrive", "💗"],
  react: "🫟",
  desc: "Owner Only - Retrieve quoted media",
  category: "owner",
  filename: __filename
}, async (client, message, match, { from, isCreator }) => {

  try {

    if (!isCreator) {
      return await client.sendMessage(from, {
        text: "*🚫 Owner Only Command!*"
      }, { quoted: message });
    }

    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*🍁 Please reply to a media message!*"
      }, { quoted: message });
    }

    const quoted = match.quoted;
    const mtype = quoted.mtype;

    if (!["imageMessage", "videoMessage", "audioMessage"].includes(mtype)) {
      return await client.sendMessage(from, {
        text: "❌ Only image, video and audio are supported."
      }, { quoted: message });
    }

    // Do not bypass View Once privacy restrictions.
    if (quoted.viewOnce || quoted.msg?.viewOnce) {
      return await client.sendMessage(from, {
        text: "⚠️ View Once media cannot be retrieved using this command."
      }, { quoted: message });
    }

    // Download ordinary quoted media
    const buffer = await quoted.download();

    if (!buffer || !buffer.length) {
      throw new Error("Media download returned an empty buffer.");
    }

    let messageContent = {};

    switch (mtype) {

      case "imageMessage":
        messageContent = {
          image: buffer,
          caption: quoted.text || "",
          mimetype: quoted.mimetype || "image/jpeg"
        };
        break;

      case "videoMessage":
        messageContent = {
          video: buffer,
          caption: quoted.text || "",
          mimetype: quoted.mimetype || "video/mp4"
        };
        break;

      case "audioMessage":
        messageContent = {
          audio: buffer,
          mimetype: quoted.mimetype || "audio/mp4",
          ptt: quoted.ptt || false
        };
        break;
    }

    await client.sendMessage(from, messageContent, {
      quoted: message
    });

  } catch (error) {

    console.error("VV Error:", error);

    await client.sendMessage(from, {
      text: "❌ Media Download Error:\n" +
        (error.message || "Unknown error")
    }, { quoted: message });

  }

});
