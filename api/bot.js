const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inisialisasi database
const db = new sqlite3.Database(path.join(__dirname, '../data/bot_database.db'));

// Buat tabel jika belum ada
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            message_content TEXT NOT NULL,
            sender_id INTEGER NOT NULL,
            sender_name TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            normalized_content TEXT NOT NULL
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS bot_instances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT UNIQUE NOT NULL,
            bot_name TEXT,
            webhook_url TEXT,
            is_active INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// Normalisasi konten pesan (menghapus spasi, tanda hubung, dll)
function normalizeContent(content) {
    return content.replace(/\s+/g, '').replace(/[-()]/g, '').toLowerCase();
}

// Fungsi untuk membuat instance bot baru
function createBotInstance(botToken, webhookUrl, botName = "Duplicate Detector Bot") {
    try {
        const bot = new TelegramBot(botToken, { polling: false });
        
        // Atur webhook
        bot.setWebHook(`${webhookUrl}/${botToken}`);
        
        // Simpan instance bot ke database
        db.run(
            'INSERT OR REPLACE INTO bot_instances (bot_token, bot_name, webhook_url, is_active) VALUES (?, ?, ?, 1)',
            [botToken, botName, webhookUrl],
            function(err) {
                if (err) {
                    console.error('Gagal menyimpan instance bot:', err);
                } else {
                    console.log(`Instance bot "${botName}" berhasil disimpan`);
                }
            }
        );
        
        return bot;
    } catch (error) {
        console.error('Gagal membuat instance bot:', error);
        return null;
    }
}

// Endpoint untuk mengaktifkan bot
app.post('/api/bot/start', async (req, res) => {
    try {
        const { botToken, botName, webhookUrl } = req.body;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Token bot diperlukan' });
        }
        
        // Buat instance bot
        const bot = createBotInstance(botToken, webhookUrl || `${req.protocol}://${req.get('host')}/api/webhook`, botName);
        
        if (!bot) {
            return res.status(500).json({ error: 'Gagal membuat instance bot' });
        }
        
        // Dapatkan info bot
        const botInfo = await bot.getMe();
        
        res.json({
            success: true,
            message: 'Bot berhasil diaktifkan',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username
            }
        });
    } catch (error) {
        console.error('Error mengaktifkan bot:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat mengaktifkan bot' });
    }
});

// Endpoint untuk menonaktifkan bot
app.post('/api/bot/stop', (req, res) => {
    const { botToken } = req.body;
    
    if (!botToken) {
        return res.status(400).json({ error: 'Token bot diperlukan' });
    }
    
    // Nonaktifkan bot di database
    db.run(
        'UPDATE bot_instances SET is_active = 0 WHERE bot_token = ?',
        [botToken],
        function(err) {
            if (err) {
                console.error('Gagal menonaktifkan bot:', err);
                return res