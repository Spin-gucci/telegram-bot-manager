const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Store active bots in memory (will reset on cold start)
let activeBots = {};

// Simple test endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    activeBots: Object.keys(activeBots).length
  });
});

// Start bot endpoint
app.post('/api/start', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    console.log('Starting bot with token:', token.substring(0, 10) + '...');
    
    // Store bot as active
    activeBots[token] = {
      token: token,
      active: true,
      startedAt: new Date(),
      lastUpdate: new Date()
    };
    
    // Return instructions for setting up the bot
    res.json({
      success: true,
      message: 'Bot setup instructions',
      instructions: [
        '1. Bot token received successfully',
        '2. Add the bot to your Telegram group',
        '3. Make the bot an admin with "Read Messages" permission',
        '4. The bot will use polling to detect duplicates'
      ],
      nextSteps: [
        'Go to Telegram and find your bot',
        'Add it to your group',
        'Promote to admin with read permissions'
      ],
      tokenPreview: token.substring(0, 15) + '...'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bot status
app.get('/api/status/:token', (req, res) => {
  const token = req.params.token;
  const bot = activeBots[token];
  
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  res.json({
    active: bot.active,
    startedAt: bot.startedAt,
    lastUpdate: bot.lastUpdate,
    uptime: Date.now() - new Date(bot.startedAt).getTime()
  });
});

// Webhook simulation endpoint
app.post('/api/webhook/:token', (req, res) => {
  const token = req.params.token;
  const update = req.body;
  
  console.log('Webhook received for token:', token.substring(0, 10) + '...');
  
  // Process message if present
  if (update.message) {
    const msg = update.message;
    console.log('Message from:', msg.from?.username, 'Text:', msg.text?.substring(0, 50));
  }
  
  res.json({ received: true });
});

// Serve HTML frontend
app.get('/', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Duplicate Bot</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
      }
      .container {
        max-width: 500px;
        margin: 0 auto;
        background: white;
        border-radius: 15px;
        padding: 30px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      }
      h1 {
        color: #333;
        margin-bottom: 10px;
        text-align: center;
      }
      .subtitle {
        color: #666;
        text-align: center;
        margin-bottom: 30px;
      }
      .form-group {
        margin-bottom: 20px;
      }
      label {
        display: block;
        margin-bottom: 8px;
        color: #333;
        font-weight: 600;
      }
      input {
        width: 100%;
        padding: 12px 15px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
      }
      input:focus {
        outline: none;
        border-color: #667eea;
      }
      .btn {
        width: 100%;
        padding: 15px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin: 10px 0;
      }
      .btn:hover {
        background: #5a67d8;
      }
      .btn-success {
        background: #10b981;
      }
      .btn-success:hover {
        background: #059669;
      }
      .status {
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
        font-weight: 600;
      }
      .status-active {
        background: #d1fae5;
        color: #065f46;
        border: 2px solid #a7f3d0;
      }
      .status-inactive {
        background: #fee2e2;
        color: #991b1b;
        border: 2px solid #fca5a5;
      }
      .instructions {
        background: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
        color: #4b5563;
      }
      .instructions h3 {
        color: #374151;
        margin-bottom: 10px;
      }
      .instructions ol {
        margin-left: 20px;
      }
      .instructions li {
        margin-bottom: 8px;
      }
      .log {
        background: #1f2937;
        color: #d1d5db;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 14px;
        margin-top: 20px;
        max-height: 200px;
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🤖 Telegram Duplicate Bot</h1>
      <p class="subtitle">Detect duplicate messages in Telegram groups</p>
      
      <div class="form-group">
        <label for="token">Bot Token:</label>
        <input type="password" id="token" placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz">
        <small style="color: #666; display: block; margin-top: 5px;">
          Get from <a href="https://t.me/BotFather" target="_blank">@BotFather</a>
        </small>
      </div>
      
      <div id="status" class="status status-inactive">
        ⚪ Bot not active
      </div>
      
      <button class="btn" onclick="startBot()">🚀 Start Bot</button>
      <button class="btn btn-success" onclick="openTelegram()">📱 Open Telegram</button>
      
      <div class="instructions">
        <h3>📚 How to setup:</h3>
        <ol>
          <li>Get bot token from @BotFather</li>
          <li>Paste token above and click "Start Bot"</li>
          <li>Find your bot in Telegram</li>
          <li>Add bot to your group</li>
          <li>Make bot admin with "Read Messages" permission</li>
        </ol>
      </div>
      
      <div class="log" id="log">
        Ready to start...
      </div>
    </div>
    
    <script>
      function log(message) {
        const logDiv = document.getElementById('log');
        const time = new Date().toLocaleTimeString();
        logDiv.innerHTML = \`[\${time}] \${message}<br>\` + logDiv.innerHTML;
      }
      
      async function startBot() {
        const token = document.getElementById('token').value.trim();
        
        if (!token) {
          alert('Please enter bot token');
          return;
        }
        
        if (!token.includes(':')) {
          alert('Invalid token format. Should be like: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz');
          return;
        }
        
        log('Starting bot...');
        
        try {
          const response = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
          });
          
          const data = await response.json();
          
          if (data.success) {
            document.getElementById('status').className = 'status status-active';
            document.getElementById('status').innerHTML = '✅ Bot setup started';
            
            log('✅ Bot setup initiated');
            log('Follow these steps:');
            data.instructions.forEach(step => log(step));
            
            // Show Telegram instructions
            setTimeout(() => {
              alert('Now go to Telegram and add the bot to your group!');
            }, 1000);
            
          } else {
            throw new Error(data.error || 'Failed to start bot');
          }
          
        } catch (error) {
          log(\`❌ Error: \${error.message}\`);
          alert(\`Error: \${error.message}\`);
        }
      }
      
      function openTelegram() {
        window.open('https://t.me/BotFather', '_blank');
      }
      
      // Test connection on load
      window.onload = async () => {
        try {
          const response = await fetch('/api/health');
          const data = await response.json();
          log(\`✅ Connected to server (v\${data.timestamp})\`);
        } catch (error) {
          log('❌ Cannot connect to server');
        }
      };
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Export for Vercel
module.exports = app;
