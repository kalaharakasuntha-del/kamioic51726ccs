const { cmd } = require("../command");

cmd({
    pattern: "messagetimer",
    alias: ["mtimer", "timeline", "msgtimer"],
    react: "⏱️",
    desc: "Set disappearing messages timer",
    category: "group",
    filename: __filename,
}, async (socket, m, store, { from, reply, args }) => {

    try {

        const option = args[0]?.toLowerCase();

        if (!option) {
            return reply(
                "*📛 Please select a timer.*\n\n" +
                "• messagetimer on → 7 days\n" +
                "• messagetimer off → Off\n" +
                "• messagetimer 24h → 24 hours\n" +
                "• messagetimer 7d → 7 days\n" +
                "• messagetimer 90d → 90 days"
            );
        }

        let timer;
        let text;

        if (option === "on") {
            timer = 604800;
            text = "7 days";
        }

        else if (option === "off") {
            timer = 0;
            text = "Off";
        }

        else if (option === "24h") {
            timer = 86400;
            text = "24 hours";
        }

        else if (option === "7d") {
            timer = 604800;
            text = "7 days";
        }

        else if (option === "90d") {
            timer = 7776000;
            text = "90 days";
        }

        else {
            return reply(
                "❌ Invalid timer.\n\n" +
                "Use:\n" +
                "• on\n" +
                "• off\n" +
                "• 24h\n" +
                "• 7d\n" +
                "• 90d"
            );
        }

        // Group
        if (from.endsWith("@g.us")) {

            await socket.groupToggleEphemeral(
                from,
                timer
            );

        }

        // Inbox / Private Chat
        else {

            await socket.sendMessage(from, {
                disappearingMessagesInChat: timer
            });

        }

        return reply(
            `✅ Message timer set to *${text}*.`
        );

    } catch (error) {

        console.error(
            "Message Timer Error:",
            error
        );

        return reply(
            "❌ Failed to change message timer."
        );
    }
});
