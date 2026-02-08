const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Telegram Duplicate Bot</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
        .step { background: #f0f9ff; padding: 15px; margin: 10px 0; border-radius: 10px; border-left: 4px solid #3b82f6; }
        .important { background: #fef3c7; border-left: 4px solid #f59e0b; }
        code { background: #1f2937; color: white; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🤖 Telegram Duplicate Message Bot</h1>
      
      <div class="step">
        <h2>📋 Step 1: Get Bot Token</h2>
        <p>1. Open Telegram, search <code>@BotFather</code></p>
        <p>2. Send: <code>/newbot</code></p>
        <p>3. Follow instructions, get token like: <code>1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz</code></p>
      </div>
      
      <div class="step">
        <h2>🚀 Step 2: Run Bot on Replit</h2>
        <p>Click this button to run your bot:</p>
        <a href="https://replit.com/@yourusername/telegram-duplicate-bot" target="_blank" 
           style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
          ▶️ Run Bot on Replit
        </a>
        <p>Or manually:</p>
        <ol>
          <li>Go to <a href="https://replit.com" target="_blank">Replit.com</a></li>
          <li>Create new Node.js project</li>
          <li>Copy code below</li>
          <li>Add token in Secrets</li>
          <li>Click Run</li>
        </ol>
      </div>
      
      <div class="step important">
        <h2>⚠️ Step 3: ADD BOT TO GROUP (CRITICAL)</h2>
        <p><strong>After bot is running on Replit:</strong></p>
        <ol>
          <li>Find your bot in Telegram (search username from @BotFather)</li>
          <li>Add bot to your group</li>
          <li><strong>MAKE BOT ADMIN:</strong> Click bot name → More → Promote to Admin</li>
          <li><strong>CHECK PERMISSIONS:</strong> ✓ Post messages ✓ Read messages</li>
        </ol>
      </div>
      
      <div class="step">
        <h2>🔧 Bot Code for Replit:</h2>
        <pre style="background: #1f2937; color: white; padding: 15px; border-radius: 8px; overflow: auto;">
const TelegramBot = require('node-telegram-bot-api');

// Get token from environment variable
const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ ERROR: BOT_TOKEN not set!');
  console.error('Add BOT_TOKEN in Replit Secrets');
  process.exit(1);
}

console.log('🤖 Starting bot with token:', token.substring(0, 15) + '...');

// Create bot with polling
const bot = new TelegramBot(token, { 
  polling: { 
    interval: 1000,  // Check every second
    timeout: 10,
    params: { 
      timeout: 10 
    }
  } 
});

// Store message history
const messageHistory = new Map(); // chatId -> {normalizedText: {userId, userName, time}}

// Normalize message (remove spaces, dashes, lowercase)
function normalizeText(text) {
  return text
    .replace(/\\s+/g, '')      // Remove spaces
    .replace(/[-+()]/g, '')    // Remove dashes, plus, parentheses
    .toLowerCase()             // Convert to lowercase
    .trim();                   // Trim whitespace
}

// Format duplicate warning
function createWarning(original, duplicate) {
  const formatTime = (date) => {
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  return \`
⚠️ <b>PESAN DUPLIKAT TERDETEKSI!</b>

📝 <b>Konten yang sama:</b> \${original.content}

📋 <b>Sejarah:</b>
├─ <b>Pertama dikirim:</b> \${original.user} (\${formatTime(original.time)})
└─ <b>Sekarang dikirim:</b> \${duplicate.user} (\${formatTime(duplicate.time)})

<i>Normalized: \${original.normalized}</i>
  \`.trim();
}

// When bot receives message
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || msg.from.username || 'Unknown';
    const messageText = msg.text || '';
    const messageId = msg.message_id;
    
    console.log(\`\\n📨 Message received in chat \${chatId}:\`);
    console.log(\`   From: \${userName} (\${userId})\`);
    console.log(\`   Text: "\${messageText}"\`);
    console.log(\`   Chat type: \${msg.chat.type}\`);
    console.log(\`   Is group: \${msg.chat.type === 'group' || msg.chat.type === 'supergroup'}\`);
    
    // Skip if:
    // 1. No text
    if (!messageText.trim()) {
      console.log('   ⏩ Skipped: Empty message');
      return;
    }
    
    // 2. From bot itself
    if (msg.from.is_bot) {
      console.log('   ⏩ Skipped: From bot');
      return;
    }
    
    // 3. Not in group (optional, bot can work in private too)
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (!isGroup) {
      console.log('   ⏩ Skipped: Not a group message');
      await bot.sendMessage(chatId, 'Bot ini bekerja di grup. Tambahkan saya ke grup untuk deteksi duplikat!');
      return;
    }
    
    // Normalize the message
    const normalized = normalizeText(messageText);
    console.log(\`   Normalized: "\${normalized}"\`);
    
    // Initialize chat history if needed
    if (!messageHistory.has(chatId)) {
      messageHistory.set(chatId, new Map());
      console.log(\`   Created history for chat \${chatId}\`);
    }
    
    const chatHistory = messageHistory.get(chatId);
    
    // Check for duplicate (same normalized text)
    if (chatHistory.has(normalized)) {
      const previous = chatHistory.get(normalized);
      
      // Only alert if from DIFFERENT user
      if (previous.userId !== userId) {
        console.log(\`   🔴 DUPLICATE DETECTED! Previous sender: \${previous.userName}\`);
        
        // Create warning message
        const warning = createWarning(
          {
            content: previous.content,
            user: previous.userName,
            time: previous.time,
            normalized: normalized
          },
          {
            content: messageText,
            user: userName,
            time: new Date(),
            normalized: normalized
          }
        );
        
        // Send warning to group
        try {
          await bot.sendMessage(chatId, warning, {
            parse_mode: 'HTML',
            reply_to_message_id: messageId
          });
          console.log('   ✅ Warning sent to group');
        } catch (sendError) {
          console.log('   ❌ Failed to send warning:', sendError.message);
        }
      } else {
        console.log('   ⏩ Same user, no warning');
      }
    } else {
      console.log('   ✅ New unique message');
    }
    
    // Always store/update the message (for future detection)
    chatHistory.set(normalized, {
      userId: userId,
      userName: userName,
      content: messageText,
      normalized: normalized,
      time: new Date()
    });
    
    // Limit history size (keep last 100 messages per chat)
    if (chatHistory.size > 100) {
      const firstKey = chatHistory.keys().next().value;
      chatHistory.delete(firstKey);
    }
    
  } catch (error) {
    console.error('❌ Error processing message:', error.message);
  }
});

// Bot started successfully
bot.on('polling_error', (error) => {
  console.error('🔴 Polling error:', error.message);
});

bot.on('error', (error) => {
  console.error('🔴 Bot error:', error.message);
});

// Get bot info when started
bot.getMe().then(botInfo => {
  console.log('\\n✅ Bot started successfully!');
  console.log(\`   Name: \${botInfo.first_name}\`);
  console.log(\`   Username: @\${botInfo.username}\`);
  console.log(\`   ID: \${botInfo.id}\`);
  console.log('\\n📋 NEXT STEPS:');
  console.log('   1. Find your bot in Telegram: @' + botInfo.username);
  console.log('   2. Add bot to your group');
  console.log('   3. MAKE BOT ADMIN with READ permission');
  console.log('   4. Test by sending duplicate messages');
  console.log('\\n📡 Bot is now listening for messages...');
}).catch(error => {
  console.error('❌ Failed to get bot info:', error.message);
  console.log('\\n🔧 TROUBLESHOOTING:');
  console.log('   - Check if token is correct');
  console.log('   - Check internet connection');
  console.log('   - Token format: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz');
});

// Keep Replit alive
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running on Replit');
}).listen(8080);

console.log('🌐 HTTP server started on port 8080');
        </pre>
      </div>
      
      <div class="step important">
        <h2>🔍 TESTING INSTRUCTIONS:</h2>
        <p>To test if bot is reading messages:</p>
        <ol>
          <li>Go to Replit console (output tab)</li>
          <li>Send message in Telegram group</li>
          <li>Check Replit console - should show "Message received"</li>
          <li>If no output, bot is NOT reading messages</li>
        </ol>
      </div>
      
      <div class="step">
        <h2>🛠️ TROUBLESHOOTING:</h2>
        <p><strong>Problem: No messages in Replit console</strong></p>
        <p><strong>Solution:</strong></p>
        <ol>
          <li><strong>CHECK ADMIN STATUS:</strong> Bot MUST be admin with READ permission</li>
          <li><strong>CHECK GROUP TYPE:</strong> Group must be "Group" or "Supergroup"</li>
          <li><strong>CHECK BOT IS RUNNING:</strong> Replit console should show "Bot started"</li>
          <li><strong>CHECK TOKEN:</strong> Verify token is correct in Replit Secrets</li>
          <li><strong>TEST MANUALLY:</strong> Try messaging bot directly (not in group)</li>
        </ol>
      </div>
      
      <script>
        // Simple test function
        function testBot() {
          const steps = [
            "1. Bot token valid?",
            "2. Bot running on Replit?",
            "3. Bot added to group?",
            "4. Bot is ADMIN?",
            "5. Bot has READ permission?",
            "6. Send test message in group",
            "7. Check Replit console for output"
          ];
          
          alert("Checklist:\\n\\n" + steps.join("\\n"));
        }
      </script>
      
      <button onclick="testBot()" style="background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; margin-top: 20px;">
        🧪 Run Bot Test Checklist
      </button>
    </body>
    </html>
  `);
});

module.exports = app;
