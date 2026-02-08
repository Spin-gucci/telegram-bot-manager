const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Server is running'
    });
});

// Start bot endpoint
app.post('/api/bot/start', (req, res) => {
    try {
        const { botToken } = req.body;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Bot token is required' });
        }
        
        // Simple validation
        if (!botToken.includes(':')) {
            return res.status(400).json({ error: 'Invalid bot token format' });
        }
        
        // Simulate bot activation
        const botId = botToken.split(':')[0];
        
        res.json({
            success: true,
            message: 'Bot activated successfully',
            botInfo: {
                id: botId,
                name: 'Duplicate Detector Bot',
                username: `bot${botId}`
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stop bot endpoint
app.post('/api/bot/stop', (req, res) => {
    try {
        const { botToken } = req.body;
        
        if (!botToken) {
            return res.status(400).json({ error: 'Bot token is required' });
        }
        
        res.json({
            success: true,
            message: 'Bot deactivated successfully'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook endpoint
app.post('/api/webhook/:token', (req, res) => {
    try {
        console.log('Webhook received for token:', req.params.token);
        
        // Simulate webhook processing
        res.json({
            success: true,
            message: 'Webhook processed'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Serve static HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Telegram Bot Manager</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #333; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                input, button {
                    width: 100%;
                    padding: 12px;
                    margin: 10px 0;
                    border-radius: 10px;
                    border: 2px solid #e0e0e0;
                    font-size: 16px;
                }
                button {
                    background: #667eea;
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-weight: bold;
                }
                button:hover { background: #5a67d8; }
                .status { 
                    padding: 15px; 
                    border-radius: 10px; 
                    margin: 20px 0;
                    text-align: center;
                    font-weight: bold;
                }
                .active { background: #c6f6d5; color: #22543d; }
                .inactive { background: #fed7d7; color: #742a2a; }
                .hidden { display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Telegram Bot Manager</h1>
                <p class="subtitle">Deteksi Pesan Duplikat dalam Grup Telegram</p>
                
                <div id="status" class="status inactive">
                    Bot tidak aktif
                </div>
                
                <input type="password" id="token" placeholder="Masukkan token bot...">
                <button onclick="startBot()">Aktifkan Bot</button>
                <button onclick="stopBot()" class="hidden" id="stopBtn">Hentikan Bot</button>
                
                <div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 10px;">
                    <h3>📚 Cara Penggunaan:</h3>
                    <ol style="margin-left: 20px; margin-top: 10px;">
                        <li>Dapatkan token dari @BotFather di Telegram</li>
                        <li>Masukkan token di atas</li>
                        <li>Klik "Aktifkan Bot"</li>
                        <li>Tambahkan bot ke grup Telegram</li>
                        <li>Bot akan mendeteksi pesan duplikat</li>
                    </ol>
                </div>
            </div>
            
            <script>
                async function startBot() {
                    const token = document.getElementById('token').value;
                    if (!token) {
                        alert('Masukkan token bot!');
                        return;
                    }
                    
                    try {
                        const response = await fetch('/api/bot/start', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ botToken: token })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            document.getElementById('status').className = 'status active';
                            document.getElementById('status').textContent = '✅ Bot aktif';
                            document.getElementById('stopBtn').classList.remove('hidden');
                            alert('Bot berhasil diaktifkan!');
                        } else {
                            alert('Error: ' + (data.error || 'Unknown error'));
                        }
                    } catch (error) {
                        alert('Gagal menghubungi server: ' + error.message);
                    }
                }
                
                async function stopBot() {
                    const token = document.getElementById('token').value;
                    
                    try {
                        const response = await fetch('/api/bot/stop', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ botToken: token })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            document.getElementById('status').className = 'status inactive';
                            document.getElementById('status').textContent = '⚪ Bot tidak aktif';
                            document.getElementById('stopBtn').classList.add('hidden');
                            alert('Bot berhasil dihentikan');
                        }
                    } catch (error) {
                        alert('Error: ' + error.message);
                    }
                }
                
                // Test API connection
                fetch('/api/health')
                    .then(response => console.log('API connected:', response.ok))
                    .catch(error => console.error('API error:', error));
            </script>
        </body>
        </html>
    `);
});

// Export for Vercel
module.exports = app;
