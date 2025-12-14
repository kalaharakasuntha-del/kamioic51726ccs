const { cmd } = require("../command");
const fs = require("fs");
const path = require("path");
const ytdl = require("ytdl-core"); // npm install ytdl-core

// Fake vCard
const fakevCard = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast"
  },
  message: {
    contactMessage: {
      displayName: "© Mr Hiruka",
      vcard: `BEGIN:VCARD
VERSION:3.0
FN:Meta
ORG:META AI;
TEL;type=CELL;type=VOICE;waid=94762095304:+94762095304
END:VCARD`
    }
  }
};

// Convert "3:17" → seconds
function toSeconds(time) {
  if (!time) return 0;
  const p = time.split(":").map(Number);
  return (p.length === 2) ? p[0] * 60 + p[1] : parseInt(time);
}

cmd({
  pattern: "csong",
  alias: ["chsong", "channelplay"],
  react: "🍁",
  desc: "Send a YouTube song to a WhatsApp Channel",
  category: "channel",
  use: ".csong <YouTube link> /<channel JID>",
  filename: __filename,
}, async (conn, mek, m, { reply, q }) => {
  try {
    if (!q || !q.includes("/")) return reply(
      "⚠️ Use format:\n.csong <YouTube link> /<channel JID>\nExample:\n.csong https://youtu.be/abcd1234 /1203630xxxxx@newsletter"
    );

    // Split link & channel JID (support space before /)
    let lastSlash = q.lastIndexOf("/");
    const input = q.substring(0, lastSlash).trim();
    const channelJid = q.substring(lastSlash + 1).trim();

    if (!channelJid.endsWith("@newsletter")) return reply("❌ Invalid channel JID! It should end with @newsletter");
    if (!input) return reply("⚠️ Please provide a YouTube link.");

    if (!input.includes("youtu")) return reply("⚠️ Only YouTube links are supported.");

    // Fetch video info
    const videoInfo = await ytdl.getInfo(input);
    const meta = {
      title: videoInfo.videoDetails.title,
      duration: videoInfo.videoDetails.lengthSeconds,
      channel: videoInfo.videoDetails.author.name,
      cover: videoInfo.videoDetails.thumbnails[videoInfo.videoDetails.thumbnails.length - 1].url
    };

    // Download audio
    const tempPath = path.join(__dirname, `../temp/${Date.now()}.mp3`);
    const stream = ytdl(input, { filter: "audioonly", quality: "highestaudio" });
    const writeStream = fs.createWriteStream(tempPath);
    await new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    // Send thumbnail + details
    const buffer = meta.cover ? Buffer.from(await (await fetch(meta.cover)).arrayBuffer()) : null;
    const caption = `🎶 *RANUMITHA-X-MD SONG SENDER* 🎶\n\n*🎧 Title*: ${meta.title}\n*🫟 Channel*: ${meta.channel}\n*🕐 Time*: ${toSeconds(meta.duration)} seconds\n\n© Powered by 𝗥𝗔𝗡𝗨𝗠𝗜𝗧𝗛𝗔-𝗫-𝗠𝗗 🌛`;

    await conn.sendMessage(channelJid, {
      image: buffer,
      caption
    }, { quoted: fakevCard });

    // Send audio
    const audioBuffer = fs.readFileSync(tempPath);
    await conn.sendMessage(channelJid, {
      audio: audioBuffer,
      mimetype: "audio/mpeg",
      ptt: false
    }, { quoted: fakevCard });

    fs.unlinkSync(tempPath);
    reply(`*✅ Song sent successfully*\n\n*🎧 Song Title*: ${meta.title}\n*🔖 Channel jid*: ${channelJid}`);

  } catch (err) {
    console.error("csong error:", err);
    reply("⚠️ Error while sending song.");
  }
});
