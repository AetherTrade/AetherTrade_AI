document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const logsContainer = document.getElementById('logsContainer');
    const refreshBtn = document.getElementById('refreshLogs');
    const exportBtn = document.getElementById('exportLogs');
    const logLevel = document.getElementById('logLevel');
    const logSource = document.getElementById('logSource');
    const logDate = document.getElementById('logDate');
    const searchLogs = document.getElementById('searchLogs');
    const viewBtns = document.querySelectorAll('.view-btn');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');

    // Sample logs data
    let logs = [];
    const logsPerPage = 20;
    let currentPage = 1;
    let filteredLogs = [];

    // Generate sample logs
    function generateSampleLogs() {
        const sources = ['system', 'user', 'api', 'security'];
        const levels = ['info', 'warning', 'error', 'critical'];
        const messages = [
            'User login attempt',
            'API request processed',
            'Database backup completed',
            'Security scan initiated',
            'System update available',
            'Memory usage exceeded threshold',
            'Network connection lost',
            'Invalid access attempt detected'
        ];

        logs = Array.from({ length: 100 }, (_, i) => {
            const date = new Date();
            date.setMinutes(date.getMinutes() - i);
            
            return {
                id: i + 1,
                timestamp: date.toISOString(),
                level: levels[Math.floor(Math.random() * levels.length)],
                source: sources[Math.floor(Math.random() * sources.length)],
                message: messages[Math.floor(Math.random() * messages.length)],
                details: `Additional details for log entry ${i + 1}`
            };
        });
    }

    // Filter logs
    function filterLogs() {
        const searchTerm = searchLogs.value.toLowerCase();
        const level = logLevel.value;
        const source = logSource.value;
        const date = logDate.value;

        filteredLogs = logs.filter(log => {
            const matchesSearch = log.message.toLowerCase().includes(searchTerm) ||
                                log.details.toLowerCase().includes(searchTerm);
            const matchesLevel = level === 'all' || log.level === level;
            const matchesSource = source === 'all' || log.source === source;
            const matchesDate = !date || log.timestamp.includes(date);

            return matchesSearch && matchesLevel && matchesSource && matchesDate;
        });

        updatePagination();
        displayLogs();
    }

    // Display logs
    function displayLogs() {
        const start = (currentPage - 1) * logsPerPage;
        const end = start + logsPerPage;
        const pageData = filteredLogs.slice(start, end);

        logsContainer.innerHTML = '';
        pageData.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${log.level}`;
            logEntry.innerHTML = `
                <div class="log-header">
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                    <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                </div>
                <div class="log-source">[${log.source}]</div>
                <div class="log-message">${log.message}</div>
                <div class="log-details">${log.details}</div>
            `;
            logsContainer.appendChild(logEntry);
        });
    }

    // Update pagination
    function updatePagination() {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        currentPageEl.textContent = currentPage;
        totalPagesEl.textContent = totalPages;
        
        prevPage.disabled = currentPage === 1;
        nextPage.disabled = currentPage === totalPages;
    }

    // Event listeners
    refreshBtn.addEventListener('click', function() {
        this.classList.add('rotating');
        generateSampleLogs();
        filterLogs();
        setTimeout(() => {
            this.classList.remove('rotating');
        }, 1000);
    });

    exportBtn.addEventListener('click', function() {
        const csv = filteredLogs.map(log => {
            return `${log.timestamp},${log.level},${log.source},"${log.message}","${log.details}"`;
        }).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'activity_logs.csv';
        a.click();
    });

    [logLevel, logSource, logDate].forEach(el => {
        el.addEventListener('change', filterLogs);
    });

    searchLogs.addEventListener('input', filterLogs);

    viewBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            viewBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            logsContainer.className = `logs-container ${this.dataset.view}`;
        });
    });

    prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayLogs();
            updatePagination();
        }
    });

    nextPage.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayLogs();
            updatePagination();
        }
    });

    // Initialize
    generateSampleLogs();
    filterLogs();
}); 