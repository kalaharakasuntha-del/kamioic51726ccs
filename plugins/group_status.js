const { cmd } = require('../command');
const baileys = require('@whiskeysockets/baileys');
const crypto = require('crypto');

/**
 * =========================================================
 * GROUP STATUS V2
 * Supports:
 *  - Text
 *  - Image
 *  - Video
 *  - Quoted Image
 *  - Quoted Video
 * =========================================================
 */

async function sendGroupStatus(conn, groupJid, content) {
    try {
        const messageSecret = crypto.randomBytes(32);

        /*
         * Background color is only useful for text status.
         * WhatsApp expects a number, not "#25D366".
         */
        const backgroundColor = content.backgroundColor || 0xFF25D366;

        // Remove custom property before generating message
        const cleanContent = { ...content };
        delete cleanContent.backgroundColor;

        /**
         * Generate actual WhatsApp message content.
         * This handles media upload automatically.
         */
        const inside = await baileys.generateWAMessageContent(
            cleanContent,
            {
                upload: conn.waUploadToServer,
                backgroundColor: backgroundColor
            }
        );

        /**
         * Add Group Status context
         */
        if (inside.imageMessage) {
            inside.imageMessage.contextInfo = {
                ...(inside.imageMessage.contextInfo || {}),
                isGroupStatus: true
            };
        }

        if (inside.videoMessage) {
            inside.videoMessage.contextInfo = {
                ...(inside.videoMessage.contextInfo || {}),
                isGroupStatus: true
            };
        }

        if (inside.extendedTextMessage) {
            inside.extendedTextMessage.contextInfo = {
                ...(inside.extendedTextMessage.contextInfo || {}),
                isGroupStatus: true
            };

            // Make sure background color exists
            inside.extendedTextMessage.backgroundArgb = backgroundColor;
        }

        /**
         * Generate Group Status V2 message
         */
        const msg = baileys.generateWAMessageFromContent(
            groupJid,
            {
                messageContextInfo: {
                    messageSecret
                },

                groupStatusMessageV2: {
                    message: {
                        ...inside,

                        messageContextInfo: {
                            messageSecret
                        }
                    }
                }
            },
            {
                userJid: conn.user?.id
            }
        );

        /**
         * Relay to WhatsApp
         */
        await conn.relayMessage(
            groupJid,
            msg.message,
            {
                messageId: msg.key.id
            }
        );

        return msg;

    } catch (error) {
        console.error(
            '❌ GROUP STATUS ERROR:',
            error?.stack || error
        );

        return null;
    }
}


/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

cmd(
    {
        pattern: 'groupstatus',
        alias: ['gstatus', 'gsx'],
        desc: 'Send a status to all members of the group.',
        category: 'group',
        use: '.groupstatus <text> OR reply to image/video',
        react: '🟢',
        filename: __filename
    },

    async (
        conn,
        mek,
        m,
        {
            from,
            reply,
            q,
            mime,
            isOwner,
            isMedia
        }
    ) => {

        try {

            /**
             * -------------------------------------------------
             * GROUP CHECK
             * -------------------------------------------------
             */

            if (!m.isGroup) {
                return reply(
                    '⚠️ *This command only works inside groups!*'
                );
            }


            /**
             * -------------------------------------------------
             * OWNER CHECK
             * -------------------------------------------------
             */

            if (!isOwner) {
                return reply(
                    '🚫 *Owner Only Command!*'
                );
            }


            /**
             * -------------------------------------------------
             * VARIABLES
             * -------------------------------------------------
             */

            let content = {};
            let statusType = 'text';


            /**
             * -------------------------------------------------
             * CHECK QUOTED MESSAGE
             * -------------------------------------------------
             */

            const quoted = m.quoted || null;

            const quotedMime = quoted?.mimetype || '';

            const currentMime = mime || '';

            const mediaMime =
                quotedMime ||
                currentMime;


            /**
             * -------------------------------------------------
             * IMAGE / VIDEO
             * -------------------------------------------------
             */

            if (
                (isMedia && /^(image|video)\//i.test(currentMime)) ||
                /^(image|video)\//i.test(quotedMime)
            ) {

                const mediaMessage = quoted || m;

                if (!mediaMessage.download) {
                    return reply(
                        '❌ Unable to download the media.'
                    );
                }

                /**
                 * Download media
                 */
                const buffer = await mediaMessage.download();

                if (!buffer) {
                    return reply(
                        '❌ Media download failed.'
                    );
                }


                /**
                 * IMAGE
                 */
                if (/^image\//i.test(mediaMime)) {

                    statusType = 'image';

                    content = {
                        image: buffer,

                        caption:
                            q ||
                            '📸 Group status updated'
                    };
                }


                /**
                 * VIDEO
                 */
                else if (/^video\//i.test(mediaMime)) {

                    statusType = 'video';

                    content = {
                        video: buffer,

                        caption:
                            q ||
                            '🎬 Group video status updated'
                    };
                }


                /**
                 * OTHER MEDIA
                 */
                else {

                    return reply(
                        '❌ Only image and video are supported.'
                    );
                }

            }


            /**
             * -------------------------------------------------
             * TEXT STATUS
             * -------------------------------------------------
             */

            else {

                if (!q || !q.trim()) {

                    return reply(
                        '📜 *Usage:*\n\n' +
                        '`.groupstatus Hello everyone!`\n\n' +
                        'Or reply to an image/video with:\n' +
                        '`.groupstatus <caption>`'
                    );
                }

                statusType = 'text';

                content = {
                    text: q.trim(),

                    // WhatsApp ARGB color
                    backgroundColor: 0xFF25D366
                };
            }


            /**
             * -------------------------------------------------
             * SEND GROUP STATUS
             * -------------------------------------------------
             */

            const statusMsg = await sendGroupStatus(
                conn,
                from,
                content
            );


            /**
             * -------------------------------------------------
             * FAILED
             * -------------------------------------------------
             */

            if (!statusMsg) {

                return reply(
                    '❌ *Failed to send Group Status.*\n\n' +
                    'Check your Baileys version and console logs.'
                );
            }


            /**
             * -------------------------------------------------
             * SUCCESS
             * -------------------------------------------------
             */

            if (statusType === 'text') {

                await reply(
                    '✅ *Group Status Posted Successfully!*\n\n' +
                    '📝 Type: Text\n' +
                    '⏳ WhatsApp status will expire automatically.'
                );

            } else if (statusType === 'image') {

                await reply(
                    '✅ *Group Status Posted Successfully!*\n\n' +
                    '📸 Type: Image\n' +
                    '⏳ WhatsApp status will expire automatically.'
                );

            } else if (statusType === 'video') {

                await reply(
                    '✅ *Group Status Posted Successfully!*\n\n' +
                    '🎬 Type: Video\n' +
                    '⏳ WhatsApp status will expire automatically.'
                );
            }


        } catch (error) {

            console.error(
                '❌ GROUPSTATUS COMMAND ERROR:',
                error?.stack || error
            );

            return reply(
                '❌ *Group Status Failed!*\n\n' +
                'Error: ' +
                (error?.message || 'Unknown error')
            );
        }
    }
);
