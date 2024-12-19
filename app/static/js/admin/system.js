document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const refreshBtn = document.getElementById('refreshStatus');
    const systemLogs = document.getElementById('systemLogs');
    
    // Sample logs data
    const sampleLogs = [
        { type: 'info', message: 'System started successfully', timestamp: '2024-03-20 10:00:00' },
        { type: 'warning', message: 'High memory usage detected', timestamp: '2024-03-20 10:01:30' },
        { type: 'error', message: 'Database connection timeout', timestamp: '2024-03-20 10:02:15' },
        { type: 'info', message: 'Backup completed', timestamp: '2024-03-20 10:03:00' }
    ];

    // Initialize system logs
    function initializeLogs() {
        systemLogs.innerHTML = '';
        sampleLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.type}`;
            logEntry.innerHTML = `
                <span class="timestamp">[${log.timestamp}]</span>
                <span class="message">${log.message}</span>
            `;
            systemLogs.appendChild(logEntry);
        });
    }

    // Update metrics animation
    function updateMetrics() {
        const metrics = document.querySelectorAll('.metric');
        metrics.forEach(metric => {
            const progress = metric.querySelector('.progress');
            const value = metric.querySelector('.value');
            if (progress && value) {
                const currentWidth = Math.floor(Math.random() * 100);
                progress.style.width = `${currentWidth}%`;
                value.textContent = `${currentWidth}%`;
            }
        });
    }

    // Refresh button click handler
    refreshBtn.addEventListener('click', function() {
        this.classList.add('rotating');
        updateMetrics();
        
        // Add new log entry
        const newLog = {
            type: 'info',
            message: 'System status refreshed',
            timestamp: new Date().toLocaleString()
        };
        sampleLogs.unshift(newLog);
        if (sampleLogs.length > 50) sampleLogs.pop();
        initializeLogs();

        setTimeout(() => {
            this.classList.remove('rotating');
        }, 1000);
    });

    // Initialize logs on page load
    initializeLogs();

    // Add hover effects to status cards
    const statusCards = document.querySelectorAll('.status-card');
    statusCards.forEach(card => {
        card.addEventListener('mouseover', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 0 20px rgba(5, 217, 232, 0.3)';
        });
        
        card.addEventListener('mouseout', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });

    // Auto-update metrics every 30 seconds
    setInterval(updateMetrics, 30000);
}); 