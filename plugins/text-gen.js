const { cmd } = require("../command");

const FONT = {
    A: [
        "01110",
        "10001",
        "10001",
        "11111",
        "10001",
        "10001",
        "10001"
    ],
    B: [
        "11110",
        "10001",
        "10001",
        "11110",
        "10001",
        "10001",
        "11110"
    ],
    C: [
        "01111",
        "10000",
        "10000",
        "10000",
        "10000",
        "10000",
        "01111"
    ],
    D: [
        "11110",
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "11110"
    ],
    E: [
        "11111",
        "10000",
        "10000",
        "11110",
        "10000",
        "10000",
        "11111"
    ],
    F: [
        "11111",
        "10000",
        "10000",
        "11110",
        "10000",
        "10000",
        "10000"
    ],
    G: [
        "01111",
        "10000",
        "10000",
        "10111",
        "10001",
        "10001",
        "01111"
    ],
    H: [
        "10001",
        "10001",
        "10001",
        "11111",
        "10001",
        "10001",
        "10001"
    ],
    I: [
        "11111",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100",
        "11111"
    ],
    J: [
        "00111",
        "00010",
        "00010",
        "00010",
        "00010",
        "10010",
        "01100"
    ],
    K: [
        "10001",
        "10010",
        "10100",
        "11000",
        "10100",
        "10010",
        "10001"
    ],
    L: [
        "10000",
        "10000",
        "10000",
        "10000",
        "10000",
        "10000",
        "11111"
    ],
    M: [
        "10001",
        "11011",
        "10101",
        "10101",
        "10001",
        "10001",
        "10001"
    ],
    N: [
        "10001",
        "11001",
        "10101",
        "10011",
        "10001",
        "10001",
        "10001"
    ],
    O: [
        "01110",
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "01110"
    ],
    P: [
        "11110",
        "10001",
        "10001",
        "11110",
        "10000",
        "10000",
        "10000"
    ],
    Q: [
        "01110",
        "10001",
        "10001",
        "10001",
        "10101",
        "10010",
        "01101"
    ],
    R: [
        "11110",
        "10001",
        "10001",
        "11110",
        "10100",
        "10010",
        "10001"
    ],
    S: [
        "01111",
        "10000",
        "10000",
        "01110",
        "00001",
        "00001",
        "11110"
    ],
    T: [
        "11111",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100"
    ],
    U: [
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "01110"
    ],
    V: [
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "01010",
        "00100"
    ],
    W: [
        "10001",
        "10001",
        "10001",
        "10101",
        "10101",
        "11011",
        "10001"
    ],
    X: [
        "10001",
        "10001",
        "01010",
        "00100",
        "01010",
        "10001",
        "10001"
    ],
    Y: [
        "10001",
        "10001",
        "01010",
        "00100",
        "00100",
        "00100",
        "00100"
    ],
    Z: [
        "11111",
        "00001",
        "00010",
        "00100",
        "01000",
        "10000",
        "11111"
    ],

    " ": [
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
        "00000"
    ]
};

// 7 square colors
const COLORS = {
    red: "🟥",
    blue: "🟦",
    green: "🟩",
    yellow: "🟨",
    orange: "🟧",
    purple: "🟪",
    lightblue: "🔲"
};

cmd({
    pattern: "textgen",
    alias: ["pixeltext", "blocktext"],
    desc: "Generate 5x7 colored text",
    category: "fun",
    use: ".textgen red HIRUKA",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {

    try {
        if (!args || args.length < 2) {
            return reply(
                "❌ Usage:\n\n" +
                ".textgen red HIRUKA\n\n" +
                "Colors:\n" +
                "🟥 red\n" +
                "🟦 blue\n" +
                "🟩 green\n" +
                "🟨 yellow\n" +
                "🟧 orange\n" +
                "🟪 purple\n" +
                "🔲 lightblue"
            );
        }

        const colorName = args[0].toLowerCase();
        const text = args.slice(1).join(" ").toUpperCase();

        if (!COLORS[colorName]) {
            return reply(
                "❌ Invalid color!\n\n" +
                "Use:\n" +
                "red, blue, green, yellow,\n" +
                "orange, purple, lightblue"
            );
        }

        if (text.length > 12) {
            return reply("❌ Maximum 12 characters!");
        }

        const COLOR = COLORS[colorName];
        const WHITE = "⬜";

        const rows = [];

        // Exactly 7 rows
        for (let row = 0; row < 7; row++) {

            const parts = [];

            for (const char of text) {

                const pattern = FONT[char] || FONT[" "];

                // Exactly 5 columns per character
                let letter = "";

                for (let col = 0; col < 5; col++) {
                    letter += pattern[row][col] === "1"
                        ? COLOR
                        : WHITE;
                }

                parts.push(letter);
            }

            // One complete white column between letters
            rows.push(parts.join(WHITE));
        }

        const result = rows.join("\n");

        await conn.sendMessage(
            from,
            { text: result },
            { quoted: mek }
        );

    } catch (error) {
        console.error("TEXTGEN ERROR:", error);
        return reply("❌ Text generation failed!");
    }
});
