// Fungsi untuk normalisasi konten pesan
function normalizeContent(content) {
    if (!content || typeof content !== 'string') {
        return '';
    }
    
    // Hapus spasi, tanda baca, dan ubah ke huruf kecil
    return content
        .replace(/\s+/g, '')           // Hapus semua spasi
        .replace(/[-+()]/g, '')        // Hapus tanda hubung dan tanda plus
        .replace(/[^\w\s]/gi, '')      // Hapus karakter khusus lainnya
        .toLowerCase()                 // Ubah ke huruf kecil
        .trim();                       // Hapus spasi di awal dan akhir
}

// Format tanggal untuk tampilan
function formatDate(date, includeTime = true) {
    const d = new Date(date);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (!includeTime) {
        return `${year}/${month}/${day}`;
    }
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// Format tanggal relatif (contoh: "2 menit yang lalu")
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
        return `${diffSec} detik yang lalu`;
    } else if (diffMin < 60) {
        return `${diffMin} menit yang lalu`;
    } else if (diffHour < 24) {
        return `${diffHour} jam yang lalu`;
    } else if (diffDay < 7) {
        return `${diffDay} hari yang lalu`;
    } else {
        return formatDate(date);
    }
}

// Validasi token bot Telegram
function isValidBotToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    // Format token: angka:hash (contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz)
    const tokenPattern = /^\d{8,11}:[a-zA-Z0-9_-]{35}$/;
    return tokenPattern.test(token);
}

// Ekstrak ID dari token bot
function extractBotIdFromToken(token) {
    if (!isValidBotToken(token)) {
        return null;
    }
    
    const parts = token.split(':');
    return parts[0];
}

// Validasi nomor telepon (contoh deteksi)
function containsPhoneNumber(text) {
    if (!text) return false;
    
    // Pola untuk nomor telepon Indonesia
    const phonePatterns = [
        /\b0\d{9,12}\b/,                    // 081234567890
        /\b\+62\d{9,12}\b/,                 // +6281234567890
        /\b62\d{9,12}\b/,                   // 6281234567890
        /\b\d{3}[-.]?\d{3}[-.]?\d{3,4}\b/   // 081-234-5678
    ];
    
    return phonePatterns.some(pattern => pattern.test(text));
}

// Ekstrak nomor telepon dari teks
function extractPhoneNumbers(text) {
    if (!text) return [];
    
    const phonePattern = /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const matches = text.match(phonePattern) || [];
    
    return matches.map(phone => phone.replace(/\D/g, '')); // Hapus semua non-digit
}

// Generate ID unik
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Sanitasi input untuk keamanan
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/[<>]/g, '')          // Hapus tag HTML
        .replace(/"/g, '&quot;')       // Escape quotes
        .replace(/'/g, '&#x27;')       // Escape apostrophe
        .trim();                       // Trim whitespace
}

// Format pesan duplikat untuk Telegram
function formatDuplicateMessage(originalMessage, duplicateMessage) {
    const originalTime = formatDate(originalMessage.timestamp);
    const duplicateTime = formatDate(duplicateMessage.timestamp);
    
    return `⚠️ *Ini sudah tercatat*

📝 *Konten yang terulang:* ${originalMessage.message_content}

📋 *Rekam sejarah:* 
• *Pengirim pertama:* ${originalMessage.sender_name} - ${originalTime} (pertama kali)
• *Pengirim saat ini:* ${duplicateMessage.sender_name} - ${duplicateTime} (kali ini)

🆔 *Chat ID:* ${originalMessage.chat_id}`;
}

// Hitung persentase duplikat
function calculateDuplicatePercentage(totalMessages, duplicates) {
    if (totalMessages === 0) return 0;
    return ((duplicates / totalMessages) * 100).toFixed(2);
}

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function dengan exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (i < maxRetries - 1) {
                const delayMs = baseDelay * Math.pow(2, i);
                console.log(`Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
                await delay(delayMs);
            }
        }
    }
    
    throw lastError;
}

// Parse chat ID dari berbagai format
function parseChatId(chatId) {
    if (!chatId) return null;
    
    // Jika sudah angka, langsung return
    if (!isNaN(chatId)) {
        return parseInt(chatId);
    }
    
    // Jika ada prefix, coba ekstrak
    if (chatId.startsWith('@')) {
        return chatId; // Username channel/grup
    }
    
    // Coba parse sebagai angka
    const parsed = parseInt(chatId.replace(/\D/g, ''));
    return isNaN(parsed) ? chatId : parsed;
}

// Group array menjadi chunks
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

module.exports = {
    normalizeContent,
    formatDate,
    formatRelativeTime,
    isValidBotToken,
    extractBotIdFromToken,
    containsPhoneNumber,
    extractPhoneNumbers,
    generateUniqueId,
    sanitizeInput,
    formatDuplicateMessage,
    calculateDuplicatePercentage,
    delay,
    retryWithBackoff,
    parseChatId,
    chunkArray,
    capitalizeFirstLetter
};