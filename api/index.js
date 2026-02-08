const TelegramBot = require('node-telegram-bot-api');

// === CONFIGURATION ===
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
// =====================

if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ ERROR: BOT_TOKEN not set!');
  console.error('Please set BOT_TOKEN in Replit Secrets:');
  console.error('1. Click on "Secrets" tab (lock icon)');
  console.error('2. Add new secret:');
  console.error('   Key: BOT_TOKEN');
  console.error('   Value: Your token from @BotFather');
  console.error('3. Restart the bot');
  process.exit(1);
}

console.log('🤖 Starting Telegram Duplicate Detector Bot...');
console.log('Token (partial):', BOT_TOKEN.substring(0, 15) + '...');

// Create bot instance with POLLING
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,      // Check every 300ms
    timeout: 10,
    params: {
      timeout: 10
    }
  }
});

// Store message history
const messageHistory = {};

// Normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, '')           // Remove all spaces
    .replace(/[-+()]/g, '')        // Remove dashes, plus, parentheses
    .replace(/[^\w]/g, '')         // Remove special characters
    .toLowerCase()                  // Convert to lowercase
    .trim();
}

// Format date for display
function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
}

// When bot starts
bot.getMe().then((botInfo) => {
  console.log('\n✅ BOT INFORMATION:');
  console.log('   Name:', botInfo.first_name);
  console.log('   Username: @' + botInfo.username);
  console.log('   ID:', botInfo.id);
  console.log('\n📡 STATUS: Bot is now running and listening for messages');
  console.log('\n⚠️  IMPORTANT: Add this bot to your Telegram group and MAKE IT ADMIN!');
  console.log('   Required permissions: ✓ Read messages ✓ Send messages');
  console.log('\n💡 Test by sending duplicate messages in your group');
}).catch((error) => {
  console.error('❌ Failed to get bot info:', error.message);
});

// Handle incoming messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || msg.from.username || 'Unknown';
  const messageText = msg.text || '';
  
  // Log received message (for debugging)
  console.log('\n📥 MESSAGE RECEIVED:');
  console.log('   From:', userName, `(ID: ${userId})`);
  console.log('   Chat:', msg.chat.title || 'Private', `(ID: ${chatId})`);
  console.log('   Type:', msg.chat.type);
  console.log('   Text:', messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''));
  
  // Skip if:
  // 1. Message is empty
  if (!messageText.trim()) {
    console.log('   ⏩ Skipped: Empty message');
    return;
  }
  
  // 2. Message is from a bot
  if (msg.from.is_bot) {
    console.log('   ⏩ Skipped: Message from another bot');
    return;
  }
  
  // 3. Not a group chat (optional)
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  if (!isGroup) {
    console.log('   ⏩ Skipped: Not a group message');
    // bot.sendMessage(chatId, 'Please add me to a group to detect duplicate messages!');
    return;
  }
  
  // Normalize the message content
  const normalizedText = normalizeText(messageText);
  console.log('   Normalized:', normalizedText.substring(0, 50) + (normalizedText.length > 50 ? '...' : ''));
  
  // Initialize history for this chat if needed
  if (!messageHistory[chatId]) {
    messageHistory[chatId] = {};
    console.log('   📝 Created new history for chat', chatId);
  }
  
  const chatHistory = messageHistory[chatId];
  
  // Check if this normalized text exists in history
  if (chatHistory[normalizedText]) {
    const previous = chatHistory[normalizedText];
    
    // Only alert if from a DIFFERENT user
    if (previous.userId !== userId) {
      console.log('   🔴 DUPLICATE DETECTED!');
      console.log('      Original sender:', previous.userName);
      console.log('      Original time:', formatDate(previous.timestamp));
      
      // Create warning message
      const warningMessage = `
⚠️ <b>PESAN DUPLIKAT TERDETEKSI!</b>

📝 <b>Konten yang sama:</b> ${previous.content}

📋 <b>Sejarah Pesan:</b>
├─ <b>Pengirim pertama:</b> ${previous.userName} - ${formatDate(previous.timestamp)} (pertama kali)
└─ <b>Pengirim saat ini:</b> ${userName} - ${formatDate(new Date())} (kali ini)

🔍 <i>Normalized: ${normalizedText.substring(0, 30)}${normalizedText.length > 30 ? '...' : ''}</i>
      `.trim();
      
      // Send warning to the group
      bot.sendMessage(chatId, warningMessage, {
        parse_mode: 'HTML',
        reply_to_message_id: messageId
      }).then(() => {
        console.log('   ✅ Warning sent to group');
      }).catch((error) => {
        console.error('   ❌ Failed to send warning:', error.message);
      });
    } else {
      console.log('   ⏩ Same user, updating timestamp');
    }
  } else {
    console.log('   ✅ New unique message');
  }
  
  // Store/update this message in history
  chatHistory[normalizedText] = {
    userId: userId,
    userName: userName,
    content: messageText,
    normalized: normalizedText,
    timestamp: new Date()
  };
  
  // Clean up old entries (keep only last 50 messages per chat)
  const entries = Object.entries(chatHistory);
  if (entries.length > 50) {
    // Sort by timestamp and remove oldest
    const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    for (let i = 50; i < sorted.length; i++) {
      delete chatHistory[sorted[i][0]];
    }
    console.log('   🧹 Cleaned up old messages');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('🔴 POLLING ERROR:', error.message);
  console.error('Code:', error.code);
});

bot.on('error', (error) => {
  console.error('🔴 BOT ERROR:', error.message);
});

// Keep Replit alive (ping every 5 minutes)
setInterval(() => {
  console.log('💓 Bot heartbeat:', new Date().toLocaleTimeString());
}, 5 * 60 * 1000);

// Simple HTTP server to keep Replit awake
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    bot: 'Telegram Duplicate Detector',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

server.listen(3000, () => {
  console.log('🌐 HTTP server listening on port 3000');
});
