const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
    }

    // Inisialisasi database
    async initialize() {
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, '../data/bot_database.db');
            
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    // Buat tabel-tabel yang diperlukan
    async createTables() {
        return new Promise((resolve, reject) => {
            // Tabel untuk instance bot
            this.db.run(`
                CREATE TABLE IF NOT EXISTS bot_instances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_token TEXT UNIQUE NOT NULL,
                    bot_name TEXT,
                    webhook_url TEXT,
                    is_active INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_active DATETIME
                )
            `);

            // Tabel untuk pesan
            this.db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_token TEXT NOT NULL,
                    chat_id INTEGER NOT NULL,
                    message_content TEXT NOT NULL,
                    sender_id INTEGER NOT NULL,
                    sender_name TEXT NOT NULL,
                    normalized_content TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (bot_token) REFERENCES bot_instances (bot_token)
                )
            `);

            // Tabel untuk log duplikat
            this.db.run(`
                CREATE TABLE IF NOT EXISTS duplicate_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_token TEXT NOT NULL,
                    chat_id INTEGER NOT NULL,
                    message_content TEXT NOT NULL,
                    original_sender_id INTEGER NOT NULL,
                    original_sender_name TEXT NOT NULL,
                    duplicate_sender_id INTEGER NOT NULL,
                    duplicate_sender_name TEXT NOT NULL,
                    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (bot_token) REFERENCES bot_instances (bot_token)
                )
            `);

            // Tabel untuk statistik
            this.db.run(`
                CREATE TABLE IF NOT EXISTS statistics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_token TEXT NOT NULL,
                    date DATE NOT NULL,
                    messages_processed INTEGER DEFAULT 0,
                    duplicates_detected INTEGER DEFAULT 0,
                    FOREIGN KEY (bot_token) REFERENCES bot_instances (bot_token),
                    UNIQUE(bot_token, date)
                )
            `);

            console.log('Database tables created/verified');
            resolve();
        });
    }

    // Simpan instance bot
    async saveBotInstance(botToken, botName, webhookUrl, isActive = true) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO bot_instances 
                 (bot_token, bot_name, webhook_url, is_active, last_active) 
                 VALUES (?, ?, ?, ?, ?)`,
                [botToken, botName, webhookUrl, isActive ? 1 : 0, new Date().toISOString()],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Dapatkan instance bot aktif
    async getActiveBotInstances() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM bot_instances WHERE is_active = 1 ORDER BY last_active DESC',
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Nonaktifkan bot
    async deactivateBot(botToken) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE bot_instances SET is_active = 0 WHERE bot_token = ?',
                [botToken],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    // Simpan pesan
    async saveMessage(botToken, chatId, messageContent, senderId, senderName, normalizedContent) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages 
                 (bot_token, chat_id, message_content, sender_id, sender_name, normalized_content) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [botToken, chatId, messageContent, senderId, senderName, normalizedContent],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Cek duplikat pesan
    async checkDuplicate(botToken, chatId, normalizedContent, currentUserId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM messages 
                 WHERE bot_token = ? 
                 AND chat_id = ? 
                 AND normalized_content = ? 
                 AND sender_id != ? 
                 ORDER BY timestamp ASC 
                 LIMIT 1`,
                [botToken, chatId, normalizedContent, currentUserId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    // Simpan log duplikat
    async saveDuplicateLog(botToken, chatId, messageContent, originalSender, duplicateSender) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO duplicate_logs 
                 (bot_token, chat_id, message_content, 
                  original_sender_id, original_sender_name,
                  duplicate_sender_id, duplicate_sender_name) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    botToken, 
                    chatId, 
                    messageContent,
                    originalSender.id,
                    originalSender.name,
                    duplicateSender.id,
                    duplicateSender.name
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Update statistik
    async updateStatistics(botToken, messagesIncrement = 0, duplicatesIncrement = 0) {
        const today = new Date().toISOString().split('T')[0];
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO statistics (bot_token, date, messages_processed, duplicates_detected)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(bot_token, date) 
                 DO UPDATE SET 
                    messages_processed = messages_processed + excluded.messages_processed,
                    duplicates_detected = duplicates_detected + excluded.duplicates_detected`,
                [botToken, today, messagesIncrement, duplicatesIncrement],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // Dapatkan statistik bot
    async getBotStatistics(botToken, days = 30) {
        return new Promise((resolve, reject) => {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);
            
            this.db.all(
                `SELECT date, SUM(messages_processed) as messages_processed, 
                        SUM(duplicates_detected) as duplicates_detected
                 FROM statistics 
                 WHERE bot_token = ? AND date >= ?
                 GROUP BY date 
                 ORDER BY date DESC`,
                [botToken, dateLimit.toISOString().split('T')[0]],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Hapus data bot
    async deleteBotData(botToken) {
        return new Promise((resolve, reject) => {
            // Mulai transaksi
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Hapus semua data terkait bot
                this.db.run('DELETE FROM bot_instances WHERE bot_token = ?', [botToken]);
                this.db.run('DELETE FROM messages WHERE bot_token = ?', [botToken]);
                this.db.run('DELETE FROM duplicate_logs WHERE bot_token = ?', [botToken]);
                this.db.run('DELETE FROM statistics WHERE bot_token = ?', [botToken]);
                
                this.db.run('COMMIT', (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
    }

    // Tutup koneksi database
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new Database();