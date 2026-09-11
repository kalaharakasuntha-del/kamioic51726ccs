const { cmd } = require("../command");

cmd({
    pattern: "addmetaai",
    alias: ["metaai"],
    desc: "Add Meta AI to group",
    category: "group",
    filename: __filename,
}, async (socket, m, store, { from, reply, isGroup }) => {

    try {

        if (!isGroup) {
            return reply("❌ This command can only be used in groups.");
        }

        await socket.groupParticipantsUpdate(
            from,
            ["867051314767696@bot"],
            "add"
        );

        return reply(
            "✅ Meta AI added to the group."
        );

    } catch (error) {

        console.error(
            "Add Meta AI Error:",
            error
        );

        return reply(
            "❌ Failed to add Meta AI.\n\n" +
            "The bot may not have permission to add participants, " +
            "or Meta AI may not be available for this group."
        );
    }
});
