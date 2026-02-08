const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const utils = require('../lib/utils');

// Middleware untuk memastikan user terautentikasi (sederhana)
const requireAuth = (req, res, next) => {
    // Untuk demo, kita gunakan token sederhana
    // Di production, gunakan sistem autentikasi yang proper
    const authToken = req.headers['authorization'] || req.query.token;
    
    if (!authToken || authToken !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Dashboard utama
router.get('/', requireAuth, async (req, res) => {
    try {
        const activeBots = await db.getActiveBotInstances();
        const today = new Date().toISOString().split('T')[0];
        
        // Hitung statistik total
        let totalMessages = 0;
        let totalDuplicates = 0;
        
        for (const bot of activeBots) {
            const stats = await db.getBotStatistics(bot.bot_token, 1);
            if (stats.length > 0) {
                totalMessages += stats[0].messages_processed || 0;
                totalDuplicates += stats[0].duplicates_detected || 0;
            }
        }
        
        res.json({
            success: true,
            data: {
                activeBots: activeBots.length,
                totalMessagesToday: totalMessages,
                totalDuplicatesToday: totalDuplicates,
                bots: activeBots.map(bot => ({
                    id: utils.extractBotIdFromToken(bot.bot_token),
                    name: bot.bot_name,
                    created: bot.created_at,
                    lastActive: bot.last_active,
                    webhookUrl: bot.webhook_url
                }))
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Detail bot
router.get('/bot/:botToken', requireAuth, async (req, res) => {
    try {
        const { botToken } = req.params;
        const { days = 30 } = req.query;
        
        // Decode URL jika perlu
        const decodedToken = decodeURIComponent(botToken);
        
        // Dapatkan statistik bot
        const stats = await db.getBotStatistics(decodedToken, parseInt(days));
        
        // Dapatkan log duplikat terbaru
        const dbInstance = db.db; // Akses instance database langsung
        const duplicateLogs = await new Promise((resolve, reject) => {
            dbInstance.all(
                `SELECT * FROM duplicate_logs 
                 WHERE bot_token = ? 
                 ORDER BY detected_at DESC 
                 LIMIT 50`,
                [decodedToken],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        // Dapatkan pesan terbaru
        const recentMessages = await new Promise((resolve, reject) => {
            dbInstance.all(
                `SELECT * FROM messages 
                 WHERE bot_token = ? 
                 ORDER BY timestamp DESC 
                 LIMIT 100`,
                [decodedToken],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        res.json({
            success: true,
            data: {
                token: decodedToken,
                statistics: stats,
                duplicateLogs: duplicateLogs.map(log => ({
                    ...log,
                    detected_at: utils.formatDate(log.detected_at)
                })),
                recentMessages: recentMessages.map(msg => ({
                    ...msg,
                    timestamp: utils.formatDate(msg.timestamp),
                    normalized_content: msg.normalized_content.substring(0, 50) + '...'
                })),
                summary: {
                    totalMessages: stats.reduce((sum, day) => sum + (day.messages_processed || 0), 0),
                    totalDuplicates: stats.reduce((sum, day) => sum + (day.duplicates_detected || 0), 0),
                    duplicateRate: utils.calculateDuplicatePercentage(
                        stats.reduce((sum, day) => sum + (day.messages_processed || 0), 0),
                        stats.reduce((sum, day) => sum + (day.duplicates_detected || 0), 0)
                    )
                }
            }
        });
    } catch (error) {
        console.error('Error loading bot details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Hapus data bot
router.delete('/bot/:botToken', requireAuth, async (req, res) => {
    try {
        const { botToken } = req.params;
        const decodedToken = decodeURIComponent(botToken);
        
        await db.deleteBotData(decodedToken);
        
        res.json({
            success: true,
            message: 'Data bot berhasil dihapus'
        });
    } catch (error) {
        console.error('Error deleting bot data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export data bot
router.get('/bot/:botToken/export', requireAuth, async (req, res) => {
    try {
        const { botToken } = req.params;
        const { format = 'json' } = req.query;
        const decodedToken = decodeURIComponent(botToken);
        
        // Dapatkan semua data bot
        const dbInstance = db.db;
        
        const [
            botInstance,
            messages,
            duplicateLogs,
            statistics
        ] = await Promise.all([
            new Promise((resolve, reject) => {
                dbInstance.get(
                    'SELECT * FROM bot_instances WHERE bot_token = ?',
                    [decodedToken],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                dbInstance.all(
                    'SELECT * FROM messages WHERE bot_token = ?',
                    [decodedToken],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                dbInstance.all(
                    'SELECT * FROM duplicate_logs WHERE bot_token = ?',
                    [decodedToken],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            }),
            new Promise((resolve, reject) => {
                dbInstance.all(
                    'SELECT * FROM statistics WHERE bot_token = ?',
                    [decodedToken],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })
        ]);
        
        const exportData = {
            bot: botInstance,
            messages: messages.length,
            duplicateLogs: duplicateLogs.length,
            statistics: statistics,
            exportedAt: new Date().toISOString()
        };
        
        if (format === 'csv') {
            // Convert ke CSV sederhana (untuk statistik)
            let csv = 'Tanggal,Pesan Diproses,Duplikat Terdeteksi\n';
            statistics.forEach(stat => {
                csv += `${stat.date},${stat.messages_processed || 0},${stat.duplicates_detected || 0}\n`;
            });
            
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', `attachment; filename="bot-${decodedToken.split(':')[0]}-export.csv"`);
            res.send(csv);
        } else {
            res.json({
                success: true,
                data: exportData
            });
        }
    } catch (error) {
        console.error('Error exporting bot data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API untuk mendapatkan grafik statistik
router.get('/bot/:botToken/chart', requireAuth, async (req, res) => {
    try {
        const { botToken } = req.params;
        const { days = 30 } = req.query;
        const decodedToken = decodeURIComponent(botToken);
        
        const stats = await db.getBotStatistics(decodedToken, parseInt(days));
        
        // Format data untuk chart
        const chartData = {
            labels: stats.map(stat => stat.date).reverse(),
            datasets: [
                {
                    label: 'Pesan Diproses',
                    data: stats.map(stat => stat.messages_processed || 0).reverse(),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Duplikat Terdeteksi',
                    data: stats.map(stat => stat.duplicates_detected || 0).reverse(),
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        };
        
        res.json({
            success: true,
            data: chartData
        });
    } catch (error) {
        console.error('Error generating chart data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected' // Ini bisa diperiksa lebih detail
    });
});

// Endpoint untuk menguji koneksi Telegram Bot API
router.post('/test-connection', requireAuth, async (req, res) => {
    try {
        const { botToken } = req.body;
        
        if (!botToken || !utils.isValidBotToken(botToken)) {
            return res.status(400).json({ error: 'Token bot tidak valid' });
        }
        
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(botToken);
        
        // Test koneksi dengan getMe
        const botInfo = await bot.getMe();
        
        res.json({
            success: true,
            message: 'Koneksi berhasil',
            botInfo: {
                id: botInfo.id,
                name: botInfo.first_name,
                username: botInfo.username,
                canJoinGroups: botInfo.can_join_groups,
                canReadAllGroupMessages: botInfo.can_read_all_group_messages,
                supportsInlineQueries: botInfo.supports_inline_queries
            }
        });
    } catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({ 
            success: false,
            error: 'Gagal terhubung ke Telegram Bot API',
            details: error.message 
        });
    }
});

module.exports = router;