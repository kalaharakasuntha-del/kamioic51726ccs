const { cmd } = require("../command");

cmd({
    pattern: "addmetaai",
    alias: ["addmetaai"],
    desc: "Add Meta AI to group",
    category: "group",
    filename: __filename,
}, async (socket, m, store, { from, reply }) => {

    try {

        if (!from.endsWith("@g.us")) {
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


cmd({
    pattern: "removemetaai",
    alias: ["removemeta", "metapalayan", "palayanmeta"],
    desc: "Remove Meta AI from group",
    category: "group",
    filename: __filename,
}, async (socket, m, store, { from, reply }) => {

    try {

        if (!from.endsWith("@g.us")) {
            return reply("❌ This command can only be used in groups.");
        }

        await socket.groupParticipantsUpdate(
            from,
            ["867051314767696@bot"],
            "remove"
        );

        return reply(
            "✅ Meta AI removed from the group."
        );

    } catch (error) {

        console.error(
            "Remove Meta AI Error:",
            error
        );

        return reply(
            "❌ Failed to remove Meta AI.\n\n" +
            "Meta AI may not be available in this group, " +
            "or the bot may not have permission."
        );
    }
});
