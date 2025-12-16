const { cmd } = require('../command')
const yts = require('yt-search')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')

cmd({
  pattern: "song4",
  react: "🎵",
  desc: "YouTube Song Downloader",
  category: "download",
  use: ".song4 <query>",
  filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
  try {

    /* ================= QUERY ================= */
    let query = q?.trim()
    if (!query && m?.quoted) {
      query =
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text
    }
    if (!query) return reply("⚠️ Song name or YouTube link ekak denna")

    if (query.includes("youtube.com/shorts/")) {
      const id = query.split("/shorts/")[1].split(/[?&]/)[0]
      query = `https://www.youtube.com/watch?v=${id}`
    }

    /* ================= SEARCH ================= */
    const search = await yts(query)
    if (!search.videos.length) return reply("❌ Song eka hambune naha")

    const video = search.videos[0]

    /* ================= API ================= */
    const api = `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(video.url)}`
    const { data } = await axios.get(api)
    if (!data?.status || !data?.data?.url) {
      return reply("❌ Download error")
    }

    const songUrl = data.data.url

    /* ================= MENU ================= */
    const sent = await conn.sendMessage(from, {
      image: { url: video.thumbnail },
      caption: `
🎵 *Song Downloader*

📌 *${video.title}*
⏱️ ${video.timestamp}

Reply with number 👇

1️⃣ Audio  
2️⃣ MP3 Document  
3️⃣ Voice Note
`
    }, { quoted: m })

    const menuId = sent.key.id

    /* ================= LISTENER ================= */
    const handler = async (up) => {
      const msg = up.messages[0]
      if (!msg?.message) return

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text

      const isReply =
        msg.message.extendedTextMessage?.contextInfo?.stanzaId === menuId

      if (!isReply) return

      await conn.sendMessage(from, { react: { text: "⬇️", key: msg.key } })

      /* ============ AUDIO ============ */
      if (text === "1") {
        await conn.sendMessage(from, { react: { text: "⬆️", key: msg.key } })
        await conn.sendMessage(from, {
          audio: { url: songUrl },
          mimetype: "audio/mpeg"
        }, { quoted: msg })
        await conn.sendMessage(from, { react: { text: "✔️", key: msg.key } })
      }

      /* ============ DOCUMENT MP3 (BUFFER) ============ */
      if (text === "2") {
        const buffer = await axios.get(songUrl, { responseType: "arraybuffer" })

        await conn.sendMessage(from, { react: { text: "⬆️", key: msg.key } })
        await conn.sendMessage(from, {
          document: buffer.data,
          mimetype: "audio/mpeg",
          fileName: `${video.title}.mp3`
        }, { quoted: msg })
        await conn.sendMessage(from, { react: { text: "✔️", key: msg.key } })
      }

      /* ============ VOICE NOTE ============ */
      if (text === "3") {
        const mp3 = path.join(__dirname, `${Date.now()}.mp3`)
        const opus = path.join(__dirname, `${Date.now()}.opus`)

        const res = await axios.get(songUrl, { responseType: "stream" })
        const w = fs.createWriteStream(mp3)
        res.data.pipe(w)
        await new Promise(r => w.on("finish", r))

        await new Promise((res, rej) => {
          ffmpeg(mp3)
            .audioCodec("libopus")
            .save(opus)
            .on("end", res)
            .on("error", rej)
        })

        await conn.sendMessage(from, { react: { text: "⬆️", key: msg.key } })
        await conn.sendMessage(from, {
          audio: fs.readFileSync(opus),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, { quoted: msg })

        await conn.sendMessage(from, { react: { text: "✔️", key: msg.key } })

        fs.unlinkSync(mp3)
        fs.unlinkSync(opus)
      }
    }

    conn.ev.on("messages.upsert", handler)

  } catch (e) {
    console.error(e)
    reply("❌ Error")
  }
})
