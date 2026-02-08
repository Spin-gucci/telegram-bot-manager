// Simulasi data dan fungsi untuk demo
let botActive = false;
let botToken = '';
let botData = {
    id: '',
    name: '',
    lastUpdate: '',
    messagesProcessed: 0,
    duplicatesDetected: 0
};

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    updateWebhookUrl();
    loadBotDataFromStorage();
    updateStatusDisplay();
    
    // Log aktivitas awal
    addLogEntry('Sistem diinisialisasi. Silakan masukkan token bot untuk memulai.');
    
    // Auto-update waktu
    setInterval(() => {
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('id-ID');
    }, 1000);
});

// Fungsi untuk memperbarui URL webhook
function updateWebhookUrl() {
    const baseUrl = window.location.origin;
    const webhookUrl = `${baseUrl}/api/webhook`;
    document.getElementById('webhookUrl').value = webhookUrl;
}

// Fungsi untuk menyalin URL webhook
function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhookUrl');
    webhookUrl.select();
    webhookUrl.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(webhookUrl.value);
        addLogEntry('URL webhook disalin ke clipboard');
        showNotification('URL webhook berhasil disalin!');
    } catch (err) {
        // Fallback untuk browser lama
        document.execCommand('copy');
        addLogEntry('URL webhook disalin ke clipboard (fallback)');
        showNotification('URL webhook berhasil disalin!');
    }
}

// Fungsi untuk memulai bot
function startBot() {
    const tokenInput = document.getElementById('botToken');
    botToken = tokenInput.value.trim();
    
    if (!botToken) {
        showNotification('Masukkan token bot terlebih dahulu!', 'error');
        addLogEntry('Gagal memulai bot: Token tidak ditemukan');
        return;
    }
    
    // Validasi format token (minimal ada tanda :)
    if (!botToken.includes(':')) {
        showNotification('Format token tidak valid!', 'error');
        addLogEntry('Gagal memulai bot: Format token tidak valid');
        return;
    }
    
    const botName = document.getElementById('botName').value.trim() || 'Bot Detector';
    
    // Simulasi pengiriman token ke server
    addLogEntry('Mengirim token ke server...');
    
    // Simulasi delay untuk koneksi ke Telegram API
    setTimeout(() => {
        // Simulasi respon sukses
        botActive = true;
        botData = {
            id: botToken.split(':')[0],
            name: botName,
            lastUpdate: new Date().toLocaleString('id-ID'),
            messagesProcessed: 0,
            duplicatesDetected: 0
        };
        
        saveBotDataToStorage();
        updateStatusDisplay();
        
        addLogEntry(`Bot "${botName}" berhasil diaktifkan dengan ID: ${botData.id}`);
        showNotification('Bot berhasil diaktifkan! Tambahkan bot ke grup Telegram Anda.');
        
        // Update statistik secara berkala (simulasi)
        simulateMessageProcessing();
        
    }, 1500);
}

// Fungsi untuk menghentikan bot
function stopBot() {
    if (!botActive) {
        showNotification('Bot tidak sedang aktif', 'warning');
        return;
    }
    
    addLogEntry('Menghentikan bot...');
    
    // Simulasi delay untuk menghentikan bot
    setTimeout(() => {
        botActive = false;
        botData.lastUpdate = new Date().toLocaleString('id-ID');
        saveBotDataToStorage();
        updateStatusDisplay();
        
        addLogEntry(`Bot "${botData.name}" berhasil dihentikan`);
        showNotification('Bot berhasil dihentikan!');
    }, 1000);
}

// Fungsi untuk menguji bot
function testBot() {
    if (!botActive) {
        showNotification('Aktifkan bot terlebih dahulu!', 'warning');
        return;
    }
    
    addLogEntry('Menguji fungsi deteksi duplikat...');
    
    // Simulasi deteksi duplikat
    setTimeout(() => {
        botData.duplicatesDetected++;
        botData.messagesProcessed += 2;
        botData.lastUpdate = new Date().toLocaleString('id-ID');
        saveBotDataToStorage();
        updateStatusDisplay();
        
        addLogEntry('Test berhasil: Deteksi duplikat berfungsi dengan baik');
        showNotification('Test berhasil! Bot dapat mendeteksi pesan duplikat.');
    }, 1000);
}

// Fungsi untuk menampilkan/menyembunyikan modal
function showInstructions() {
    document.getElementById('instructionsModal').style.display = 'flex';
}

function showAbout() {
    document.getElementById('aboutModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Fungsi untuk memperbarui tampilan status
function updateStatusDisplay() {
    const statusElement = document.getElementById('botStatus');
    const botIdElement = document.getElementById('botId');
    const botNameElement = document.getElementById('displayBotName');
    const lastUpdateElement = document.getElementById('lastUpdate');
    const messagesProcessedElement = document.getElementById('messagesProcessed');
    const duplicatesDetectedElement = document.getElementById('duplicatesDetected');
    
    if (botActive) {
        statusElement.className = 'status status-active';
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Bot aktif';
    } else {
        statusElement.className = 'status status-inactive';
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Bot tidak aktif';
    }
    
    botIdElement.textContent = botData.id || '-';
    botNameElement.textContent = botData.name || '-';
    lastUpdateElement.textContent = botData.lastUpdate || '-';
    messagesProcessedElement.textContent = botData.messagesProcessed;
    duplicatesDetectedElement.textContent = botData.duplicatesDetected;
}

// Fungsi untuk menambahkan entri log
function addLogEntry(message) {
    const logContainer = document.getElementById('activityLog');
    const time = new Date().toLocaleTimeString('id-ID', {hour12: false});
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.prepend(logEntry);
    
    // Batasi jumlah log yang ditampilkan
    const logEntries = logContainer.querySelectorAll('.log-entry');
    if (logEntries.length > 20) {
        logEntries[logEntries.length - 1].remove();
    }
}

// Fungsi untuk menghapus log
function clearLogs() {
    const logContainer = document.getElementById('activityLog');
    logContainer.innerHTML = `
        <div class="log-entry">
            <span class="log-time">${new Date().toLocaleTimeString('id-ID', {hour12: false})}</span>
            <span class="log-message">Log berhasil dihapus</span>
        </div>
    `;
    addLogEntry('Log aktivitas berhasil dihapus');
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message, type = 'success') {
    // Buat elemen notifikasi
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Tambahkan ke body
    document.body.appendChild(notification);
    
    // Atur style notifikasi
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
        max-width: 400px;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = 'var(--success-color)';
    } else if (type === 'error') {
        notification.style.backgroundColor = 'var(--danger-color)';
    } else if (type === 'warning') {
        notification.style.backgroundColor = 'var(--warning-color)';
        notification.style.color = 'var(--dark-color)';
    } else {
        notification.style.backgroundColor = 'var(--primary-color)';
    }
    
    // Hapus notifikasi setelah 3 detik
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Animasi CSS untuk notifikasi
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

// Fungsi untuk menyimpan data bot ke localStorage
function saveBotDataToStorage() {
    localStorage.setItem('telegramBotData', JSON.stringify({
        active: botActive,
        token: botToken,
        data: botData
    }));
}

// Fungsi untuk memuat data bot dari localStorage
function loadBotDataFromStorage() {
    const savedData = localStorage.getItem('telegramBotData');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        botActive = parsedData.active;
        botToken = parsedData.token;
        botData = parsedData.data;
        
        // Isi form dengan data yang disimpan
        if (botToken) {
            document.getElementById('botToken').value = botToken;
        }
        if (botData.name) {
            document.getElementById('botName').value = botData.name;
        }
    }
}

// Simulasi pemrosesan pesan (untuk demo)
function simulateMessageProcessing() {
    if (!botActive) return;
    
    // Update setiap 5-10 detik
    const updateInterval = 5000 + Math.random() * 5000;
    
    setTimeout(() => {
        if (botActive) {
            // Simulasi pesan baru
            const newMessages = Math.floor(Math.random() * 3) + 1;
            botData.messagesProcessed += newMessages;
            botData.lastUpdate = new Date().toLocaleString('id-ID');
            
            // Simulasi deteksi duplikat (10% kemungkinan)
            if (Math.random() < 0.1) {
                botData.duplicatesDetected++;
                addLogEntry(`Duplikat terdeteksi: +62 812-3456-7890`);
            }
            
            saveBotDataToStorage();
            updateStatusDisplay();
            
            // Lanjutkan simulasi
            simulateMessageProcessing();
        }
    }, updateInterval);
}

// Event listener untuk menutup modal dengan klik di luar
window.addEventListener('click', function(event) {
    const instructionsModal = document.getElementById('instructionsModal');
    const aboutModal = document.getElementById('aboutModal');
    
    if (event.target === instructionsModal) {
        instructionsModal.style.display = 'none';
    }
    
    if (event.target === aboutModal) {
        aboutModal.style.display = 'none';
    }
});