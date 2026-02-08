const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const url = require('url');

const router = express.Router();

// Inisialisasi database
const db = new sqlite3.Database(path.join(__dirname, '../data/bot_database.db'));

// Normalisasi konten pesan
function normalizeContent(content) {
    if (!content) return '';
    return content
        .replace(/\s+/g, '')
        .replace(/[-+()]/g, '')
        .replace(/[^\w\s]/gi, '')
        .toLowerCase()
        .trim();
}

// Format tanggal untuk Telegram
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Fungsi untuk menangani pesan yang masuk
async function handleMessage(msg, bot) {
    try {
        const chatId = msg.chat.id;
        const messageId = msg.message_id;
        const userId = msg.from.id;
        const userName = msg.from.first_name || msg.from.username || 'Unknown User';
        const messageText = msg.text || '';
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        // Hanya proses pesan di grup
        if (!isGroup) {
            await bot.sendMessage(chatId, 'Bot ini hanya berfungsi dalam grup. Tambahkan saya ke grup Anda untuk mendeteksi pesan duplikat.');
            return;
        }

        // Abaikan pesan dari bot
        if (msg.from.is_bot) {
            return;
        }

        // Normalisasi konten pesan
        const normalizedContent = normalizeContent(messageText);

        // Abaikan jika pesan kosong setelah dinormalisasi
        if (!normalizedContent || normalizedContent.length < 3) {
            return;
        }

        // Cek apakah pesan sudah pernah dikirim sebelumnya
        db.get(
            `SELECT * FROM messages 
             WHERE normalized_content = ? 
             AND chat_id = ? 
             AND sender_id != ? 
             ORDER BY timestamp ASC 
             LIMIT 1`,
            [normalizedContent, chatId, userId],
            async (err, previousMessage) => {
                if (err) {
                    console.error('Error querying database:', err);
                    return;
                }

                // Jika ditemukan pesan duplikat
                if (previousMessage) {
                    // Format pesan peringatan
                    const warningMessage = 
`⚠️ *Ini sudah tercatat*

📝 *Konten yang terulang:* ${previousMessage.message_content}

📋 *Rekam sejarah:* 
• *Pengirim pertama:* ${previousMessage.sender_name} - ${formatDate(previousMessage.timestamp)} (pertama kali)
• *Pengirim saat ini:* ${userName} - ${formatDate(new Date())} (kali ini)`;

                    // Kirim pesan peringatan
                    await bot.sendMessage(chatId, warningMessage, {
                        parse_mode: 'Markdown',
                        reply_to_message_id: messageId
                    });

                    // Log ke database
                    db.run(
                        'INSERT INTO duplicate_logs (chat_id, message_content, original_sender_id, duplicate_sender_id, detected_at) VALUES (?, ?, ?, ?, ?)',
                        [chatId, messageText, previousMessage.sender_id, userId, new Date().toISOString()]
                    );
                }

                // Simpan pesan saat ini ke database (jika belum ada dari pengguna yang sama)
                db.get(
                    'SELECT id FROM messages WHERE normalized_content = ? AND chat_id = ? AND sender_id = ?',
                    [normalizedContent, chatId, userId],
                    (err, existing) => {
                        if (err) {
                            console.error('Error checking existing message:', err);
                            return;
                        }

                        if (!existing) {
                            db.run(
                                'INSERT INTO messages (chat_id, message_content, sender_id, sender_name, normalized_content) VALUES (?, ?, ?, ?, ?)',
                                [chatId, messageText, userId, userName, normalizedContent]
                            );
                        }
                    }
                );
            }
        );

    } catch (error) {
        console.error('Error handling message:', error);
    }
}

// Endpoint webhook untuk menerima update dari Telegram
router.post('/:botToken', express.json(), async (req, res) => {
    try {
        const botToken = req.params.botToken;
        
        if (!botToken) {
            return res.status(400).send('Token bot diperlukan');
        }

        const update = req.body;
        
        // Cek apakah bot aktif di database
        db.get('SELECT * FROM bot_instances WHERE bot_token = ? AND is_active = 1', [botToken], async (err, instance) => {
            if (err || !instance) {
                return res.status(404).send('Bot tidak ditemukan atau tidak aktif');
            }

            // Buat instance bot
            const bot = new TelegramBot(botToken);
            
            // Jika ada pesan
            if (update.message) {
                await handleMessage(update.message, bot);
            }
            
            // Jika ada callback query (untuk tombol, dll)
            if (update.callback_query) {
                await bot.answerCallbackQuery(update.callback_query.id);
            }

            res.send('OK');
        });
    } catch (error) {
        console.error('Error in webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint untuk mengatur webhook
router.post('/set/:botToken', async (req, res) => {
    try {
        const botToken = req.params.botToken;
        const webhookUrl = req.body.webhookUrl || `${req.protocol}://${req.get('host')}/api/webhook/${botToken}`;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Token bot diperlukan' });
        }
        
        const bot = new TelegramBot(botToken);
        
        // Set webhook
        const result = await bot.setWebHook(webhookUrl);
        
        // Update database
        db.run(
            'UPDATE bot_instances SET webhook_url = ? WHERE bot_token = ?',
            [webhookUrl, botToken]
        );
        
        res.json({
            success: true,
            message: 'Webhook berhasil diatur',
            webhookUrl: webhookUrl,
            result: result
        });
    } catch (error) {
        console.error('Error setting webhook:', error);
        res.status(500).json({ error: 'Gagal mengatur webhook' });
    }
});

// Endpoint untuk mendapatkan info webhook
router.get('/info/:botToken', async (req, res) => {
    try {
        const botToken = req.params.botToken;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Token bot diperlukan' });
        }
        
        const bot = new TelegramBot(botToken);
        const webhookInfo = await bot.getWebHookInfo();
        
        res.json({
            success: true,
            webhookInfo: webhookInfo
        });
    } catch (error) {
        console.error('Error getting webhook info:', error);
        res.status(500).json({ error: 'Gagal mendapatkan info webhook' });
    }
});

module.exports = router;