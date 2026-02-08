const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simpan bot instances dalam memory
const activeBots = new Map();
const messageHistory = new Map(); // Untuk menyimpan pesan

// Fungsi untuk normalisasi konten pesan
function normalizeMessage(content) {
    return content
        .replace(/\s+/g, '')           // Hapus semua spasi
        .replace(/[-+()]/g, '')        // Hapus tanda hubung dan plus
        .toLowerCase()                  // Ubah ke huruf kecil
        .trim();
}

// Endpoint untuk mengaktifkan bot
app.post('/api/bot/start', async (req, res) => {
    try {
        const { botToken, webhookUrl } = req.body;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Token bot diperlukan' });
        }

        // Validasi format token
        if (!botToken.includes(':')) {
            return res.status(400).json({ error: 'Format token tidak valid' });
        }

        // Cek apakah bot sudah aktif
        if (activeBots.has(botToken)) {
            return res.json({
                success: true,
                message: 'Bot sudah aktif',
                botId: botToken.split(':')[0]
            });
        }

        // Buat instance bot dengan polling (lebih mudah untuk testing)
        const bot = new TelegramBot(botToken, { polling: true });

        // Simpan bot instance
        activeBots.set(botToken, bot);
        
        // Inisialisasi message history untuk bot ini
        messageHistory.set(botToken, new Map());

        // Setup event handlers
        setupBotHandlers(bot, botToken);

        try {
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
            activeBots.delete(botToken);
            throw error;
        }

    } catch (error) {
        console.error('Error starting bot:', error.message);
        res.status(500).json({ 
            error: 'Gagal mengaktifkan bot',
            details: error.message 
        });
    }
});

// Fungsi untuk setup bot handlers
function setupBotHandlers(bot, botToken) {
    console.log(`Setting up handlers for bot: ${botToken.split(':')[0]}`);
    
    // Handler untuk pesan baru
    bot.on('message', async (msg) => {
        try {
            const chatId = msg.chat.id;
            const messageId = msg.message_id;
            const userId = msg.from.id;
            const userName = msg.from.first_name || msg.from.username || 'Unknown';
            const messageText = msg.text || '';
            const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

            // Abaikan jika bukan grup
            if (!isGroup) {
                console.log(`Ignoring non-group message from ${userName}`);
                return;
            }

            // Abaikan jika dari bot
            if (msg.from.is_bot) {
                return;
            }

            // Abaikan pesan kosong
            if (!messageText.trim()) {
                return;
            }

            console.log(`New message from ${userName} in chat ${chatId}: ${messageText.substring(0, 50)}...`);

            // Normalisasi pesan
            const normalizedContent = normalizeMessage(messageText);
            
            // Dapatkan history untuk chat ini
            const botHistory = messageHistory.get(botToken);
            if (!botHistory.has(chatId)) {
                botHistory.set(chatId, new Map());
            }
            const chatHistory = botHistory.get(chatId);

            // Cek apakah pesan ini duplikat
            if (chatHistory.has(normalizedContent)) {
                const previousMessage = chatHistory.get(normalizedContent);
                
                // Pastikan bukan dari pengguna yang sama
                if (previousMessage.userId !== userId) {
                    console.log(`Duplicate detected! Original: ${previousMessage.userName}, Current: ${userName}`);
                    
                    // Format pesan warning
                    const warningMessage = formatDuplicateWarning(
                        messageText,
                        previousMessage,
                        { userId, userName, timestamp: new Date() }
                    );
                    
                    // Kirim pesan warning
                    await bot.sendMessage(chatId, warningMessage, {
                        parse_mode: 'HTML',
                        reply_to_message_id: messageId
                    });

                    // Log ke console
                    console.log(`Sent duplicate warning for: ${normalizedContent.substring(0, 30)}...`);
                }
            } else {
                // Simpan pesan baru ke history
                chatHistory.set(normalizedContent, {
                    userId: userId,
                    userName: userName,
                    content: messageText,
                    normalized: normalizedContent,
                    timestamp: new Date()
                });

                // Batasi jumlah pesan yang disimpan (100 per chat)
                if (chatHistory.size > 100) {
                    const firstKey = chatHistory.keys().next().value;
                    chatHistory.delete(firstKey);
                }
            }

        } catch (error) {
            console.error('Error handling message:', error.message);
        }
    });

    // Handler untuk error
    bot.on('error', (error) => {
        console.error(`Bot error for ${botToken.split(':')[0]}:`, error.message);
    });

    // Handler untuk polling start
    bot.on('polling_error', (error) => {
        console.error(`Polling error for ${botToken.split(':')[0]}:`, error.message);
    });

    console.log(`Bot ${botToken.split(':')[0]} handlers setup complete`);
}

// Format pesan duplicate warning
function formatDuplicateWarning(content, original, current) {
    const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    };

    return `
⚠️ <b>Ini sudah tercatat</b>

📝 <b>Konten yang terulang:</b> ${content}

📋 <b>Rekam sejarah:</b>
├─ <b>Pengirim pertama:</b> ${original.userName} - ${formatDate(original.timestamp)} (pertama kali)
└─ <b>Pengirim saat ini:</b> ${current.userName} - ${formatDate(current.timestamp)} (kali ini)
    `.trim();
}

// Endpoint untuk menonaktifkan bot
app.post('/api/bot/stop', async (req, res) => {
    try {
        const { botToken } = req.body;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Token bot diperlukan' });
        }

        const bot = activeBots.get(botToken);
        
        if (!bot) {
            return res.json({
                success: true,
                message: 'Bot tidak aktif'
            });
        }

        // Stop polling
        bot.stopPolling();
        
        // Hapus dari memory
        activeBots.delete(botToken);
        messageHistory.delete(botToken);

        res.json({
            success: true,
            message: 'Bot berhasil dihentikan'
        });

    } catch (error) {
        console.error('Error stopping bot:', error.message);
        res.status(500).json({ 
            error: 'Gagal menghentikan bot',
            details: error.message 
        });
    }
});

// Endpoint untuk status bot
app.get('/api/bot/status/:botToken', (req, res) => {
    const botToken = req.params.botToken;
    const bot = activeBots.get(botToken);
    
    if (!bot) {
        return res.json({
            active: false,
            message: 'Bot tidak aktif'
        });
    }

    const botHistory = messageHistory.get(botToken);
    let totalMessages = 0;
    
    if (botHistory) {
        for (const chatHistory of botHistory.values()) {
            totalMessages += chatHistory.size;
        }
    }

    res.json({
        active: true,
        totalMessages: totalMessages,
        activeChats: botHistory ? botHistory.size : 0
    });
});

// Endpoint untuk test webhook
app.post('/api/bot/test', async (req, res) => {
    try {
        const { botToken, chatId, message } = req.body;
        
        if (!botToken || !chatId) {
            return res.status(400).json({ error: 'botToken dan chatId diperlukan' });
        }

        const bot = activeBots.get(botToken);
        
        if (!bot) {
            return res.status(400).json({ error: 'Bot tidak aktif' });
        }

        const testMessage = message || 'Test message from bot manager';
        await bot.sendMessage(chatId, testMessage);
        
        res.json({
            success: true,
            message: 'Test message sent'
        });

    } catch (error) {
        console.error('Error sending test:', error.message);
        res.status(500).json({ 
            error: 'Gagal mengirim test',
            details: error.message 
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        activeBots: activeBots.size,
        uptime: process.uptime()
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Telegram Bot Manager - Deteksi Duplikat</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #333; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                .card {
                    background: #f7fafc;
                    border-radius: 15px;
                    padding: 25px;
                    margin-bottom: 25px;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #333;
                }
                input {
                    width: 100%;
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 16px;
                }
                input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                .btn {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 10px;
                    transition: background 0.3s;
                }
                .btn:hover { background: #5a67d8; }
                .btn-success { background: #48bb78; }
                .btn-success:hover { background: #38a169; }
                .btn-danger { background: #f56565; }
                .btn-danger:hover { background: #e53e3e; }
                .status {
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-weight: 600;
                    text-align: center;
                }
                .status-active { background: #c6f6d5; color: #22543d; border: 2px solid #9ae6b4; }
                .status-inactive { background: #fed7d7; color: #742a2a; border: 2px solid #fc8181; }
                .hidden { display: none; }
                .log {
                    background: #2d3748;
                    color: #e2e8f0;
                    padding: 15px;
                    border-radius: 10px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    max-height: 300px;
                    overflow-y: auto;
                    margin-top: 20px;
                }
                .example {
                    background: #fffaf0;
                    border-left: 4px solid #ed8936;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 0 10px 10px 0;
                }
                #logs { white-space: pre-wrap; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Telegram Bot Manager</h1>
                <p class="subtitle">Deteksi Pesan Duplikat dalam Grup Telegram</p>
                
                <div class="card">
                    <h2>⚙️ Konfigurasi Bot</h2>
                    <div class="form-group">
                        <label for="botToken">Token Bot Telegram:</label>
                        <input type="password" id="botToken" 
                               placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz">
                        <small style="color: #666; display: block; margin-top: 5px;">
                            Dapatkan token dari <a href="https://t.me/BotFather" target="_blank">@BotFather</a>
                        </small>
                    </div>
                    
                    <div id="botStatus" class="status status-inactive">
                        ⚪ Bot tidak aktif
                    </div>
                    
                    <button id="startBtn" class="btn" onclick="startBot()">
                        🚀 Aktifkan Bot
                    </button>
                    <button id="stopBtn" class="btn btn-danger hidden" onclick="stopBot()">
                        ⏹️ Hentikan Bot
                    </button>
                    
                    <div id="botInfo" class="hidden" style="margin-top: 20px;">
                        <h3>📊 Info Bot:</h3>
                        <p><strong>ID Bot:</strong> <span id="botId">-</span></p>
                        <p><strong>Status:</strong> <span id="statusText">-</span></p>
                        <p><strong>Pesan Dipantau:</strong> <span id="messageCount">0</span></p>
                    </div>
                </div>
                
                <div class="card">
                    <h2>📝 Contoh Deteksi</h2>
                    <div class="example">
                        <p><strong>Contoh pesan duplikat:</strong></p>
                        <p>User A: "+62 881-0376-00892" (2026/01/01 14:05:26)</p>
                        <p>User B: "+62 881-0376-00892" (2026/02/08 18:24:02)</p>
                        <hr style="margin: 10px 0; border: 1px solid #e2e8f0;">
                        <p><strong>Bot akan membalas:</strong></p>
                        <p>⚠️ <b>Ini sudah tercatat</b></p>
                        <p><b>Konten yang terulang:</b> 62881037600892</p>
                        <p><b>Rekam sejarah:</b></p>
                        <p>• Pengirim pertama: User A - 2026/01/01 14:05:26 (pertama kali)</p>
                        <p>• Pengirim saat ini: User B - 2026/02/08 18:24:02 (kali ini)</p>
                    </div>
                </div>
                
                <div class="card">
                    <h2>📋 Log Aktivitas</h2>
                    <div class="log" id="logContent">
                        <div id="logs">Menunggu aktivitas...</div>
                    </div>
                    <button class="btn" onclick="clearLogs()" style="margin-top: 10px;">
                        🗑️ Hapus Log
                    </button>
                </div>
                
                <div class="card">
                    <h2>📚 Instruksi</h2>
                    <ol style="margin-left: 20px; color: #666;">
                        <li>Dapatkan token dari @BotFather di Telegram</li>
                        <li>Masukkan token dan klik "Aktifkan Bot"</li>
                        <li>Temukan bot Anda di Telegram (username: @namabot Anda)</li>
                        <li>Tambahkan bot ke grup yang ingin dipantau</li>
                        <li>Berikan izin admin untuk membaca pesan</li>
                        <li>Bot akan otomatis mendeteksi pesan duplikat</li>
                        <li>Coba kirim pesan yang sama dari dua pengguna berbeda</li>
                    </ol>
                </div>
            </div>
            
            <script>
                let currentBotToken = '';
                
                // Fungsi untuk menambah log
                function addLog(message) {
                    const logs = document.getElementById('logs');
                    const time = new Date().toLocaleTimeString();
                    logs.innerHTML = `<div>[${time}] ${message}</div>` + logs.innerHTML;
                }
                
                // Fungsi untuk membersihkan log
                function clearLogs() {
                    document.getElementById('logs').innerHTML = 'Log berhasil dibersihkan';
                }
                
                // Fungsi untuk memulai bot
                async function startBot() {
                    const token = document.getElementById('botToken').value.trim();
                    
                    if (!token) {
                        alert('Masukkan token bot terlebih dahulu!');
                        return;
                    }
                    
                    if (!token.includes(':')) {
                        alert('Format token tidak valid! Harus seperti: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz');
                        return;
                    }
                    
                    try {
                        addLog('Mengaktifkan bot...');
                        
                        const response = await fetch('/api/bot/start', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                botToken: token
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            currentBotToken = token;
                            
                            // Update UI
                            document.getElementById('botStatus').className = 'status status-active';
                            document.getElementById('botStatus').innerHTML = '✅ Bot aktif';
                            document.getElementById('startBtn').classList.add('hidden');
                            document.getElementById('stopBtn').classList.remove('hidden');
                            document.getElementById('botInfo').classList.remove('hidden');
                            
                            document.getElementById('botId').textContent = data.botInfo.id;
                            document.getElementById('statusText').textContent = 'Aktif';
                            
                            addLog(`✅ Bot "${data.botInfo.name}" berhasil diaktifkan!`);
                            addLog(`ID Bot: ${data.botInfo.id}`);
                            addLog('Sekarang tambahkan bot ke grup Telegram Anda');
                            addLog('Pastikan bot memiliki izin admin untuk membaca pesan');
                            
                            // Mulai polling status
                            startStatusPolling();
                            
                        } else {
                            throw new Error(data.error || 'Gagal mengaktifkan bot');
                        }
                    } catch (error) {
                        addLog(`❌ Error: ${error.message}`);
                        alert('Gagal mengaktifkan bot: ' + error.message);
                    }
                }
                
                // Fungsi untuk menghentikan bot
                async function stopBot() {
                    if (!confirm('Apakah Anda yakin ingin menghentikan bot?')) {
                        return;
                    }
                    
                    try {
                        addLog('Menghentikan bot...');
                        
                        const response = await fetch('/api/bot/stop', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                botToken: currentBotToken
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            // Update UI
                            document.getElementById('botStatus').className = 'status status-inactive';
                            document.getElementById('botStatus').innerHTML = '⚪ Bot tidak aktif';
                            document.getElementById('startBtn').classList.remove('hidden');
                            document.getElementById('stopBtn').classList.add('hidden');
                            document.getElementById('botInfo').classList.add('hidden');
                            
                            addLog('✅ Bot berhasil dihentikan');
                            currentBotToken = '';
                        }
                    } catch (error) {
                        addLog(`❌ Error menghentikan bot: ${error.message}`);
                    }
                }
                
                // Fungsi untuk polling status bot
                function startStatusPolling() {
                    if (!currentBotToken) return;
                    
                    const poll = async () => {
                        try {
                            const response = await fetch(\`/api/bot/status/\${encodeURIComponent(currentBotToken)}\`);
                            const data = await response.ok ? await response.json() : { active: false };
                            
                            if (data.active) {
                                document.getElementById('messageCount').textContent = data.totalMessages || 0;
                            }
                        } catch (error) {
                            console.log('Polling error:', error);
                        }
                    };
                    
                    // Poll setiap 10 detik
                    poll();
                    setInterval(poll, 10000);
                }
                
                // Test koneksi saat halaman dimuat
                window.onload = async () => {
                    try {
                        const response = await fetch('/api/health');
                        if (response.ok) {
                            addLog('✅ Terhubung ke server');
                        }
                    } catch (error) {
                        addLog('❌ Tidak dapat terhubung ke server');
                    }
                };
                
                // Simulasikan duplikat untuk testing
                window.testDuplicate = () => {
                    addLog('🚀 Simulasi: User A mengirim "+62 881-0376-00892"');
                    setTimeout(() => {
                        addLog('🚀 Simulasi: User B mengirim "+62 881-0376-00892" (DUPLIKAT!)');
                        setTimeout(() => {
                            addLog('⚠️ BOT: Duplikat terdeteksi! Mengirim peringatan...');
                        }, 1000);
                    }, 2000);
                };
            </script>
        </body>
        </html>
    `);
});

// Export untuk Vercel
module.exports = app;
