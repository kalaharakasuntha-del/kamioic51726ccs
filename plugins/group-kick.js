const { cmd } = require('../command');

cmd({
    pattern: "kick",
    alias: ["remove", "k"],
    desc: "Removes a user from the group by reply or mention",
    category: "admin",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        if (!from.endsWith("@g.us")) return reply("📛 *Group only command!*");

        // Fetch group metadata for admin checks
        const groupMetadata = await conn.groupMetadata(from);
        const participants = groupMetadata.participants || [];

        const senderJid = mek.sender;
        const botJid = conn.user.id.split(":")[0] + "@s.whatsapp.net";

        // Get sender and bot info
        const sender = participants.find(p => p.id === senderJid);
        const bot = participants.find(p => p.id === botJid);

        // Admin checks
        const isSenderAdmin = sender?.admin === "admin" || sender?.admin === "superadmin";
        const isBotAdmin = bot?.admin === "admin" || bot?.admin === "superadmin";

        if (!isSenderAdmin) return reply("📛 *You must be a group admin!*");
        if (!isBotAdmin) return reply("📛 *Bot must be admin to remove users!*");

        // Determine target
        let targetJid;
        const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentioned && mentioned.length > 0) {
            targetJid = mentioned[0];
        } else if (mek.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = mek.message.extendedTextMessage.contextInfo.participant;
        } else {
            return reply("⚠️ *Reply to a user or @mention them to kick!*");
        }

        // Prevent bot from kicking itself
        if (targetJid === botJid) return reply("😅 *I can't remove myself!*");

        // Remove the participant
        await conn.groupParticipantsUpdate(from, [targetJid], "remove");

        // Confirm removal
        await conn.sendMessage(from, {
            text: `✅ *Removed:* @${targetJid.split("@")[0]}`,
            mentions: [targetJid]
        });

    } catch (err) {
        console.error("Kick Error:", err);
        let errMsg = "❌ *Failed to remove user!*";

        if (err?.output?.statusCode === 409) {
            errMsg = "⚠️ *Cannot remove this user (maybe admin or permissions issue)*";
        }

        reply(errMsg);
    }
});
