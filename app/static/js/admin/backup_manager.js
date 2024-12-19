class BackupManager {
    constructor() {
        this.initializeUI();
        this.loadStats();
    }

    initializeUI() {
        // Add backup management section to admin dashboard
        const section = `
            <div class="backup-manager">
                <h2>Backup Management</h2>
                
                <!-- Stats Overview -->
                <div class="stats-panel">
                    <h3>Backup Statistics</h3>
                    <div id="backup-stats"></div>
                </div>

                <!-- User History -->
                <div class="user-history-panel">
                    <h3>User History</h3>
                    <div class="search-box">
                        <input type="text" id="username-search" placeholder="Enter username">
                        <button onclick="backupManager.searchUserHistory()">Search</button>
                    </div>
                    <div id="user-history-results"></div>
                </div>

                <!-- Restore Panel -->
                <div class="restore-panel">
                    <h3>Restore User Data</h3>
                    <div class="restore-form">
                        <input type="text" id="restore-username" placeholder="Username">
                        <select id="backup-select">
                            <option value="">Select backup...</option>
                        </select>
                        <button onclick="backupManager.restoreUser()">Restore</button>
                    </div>
                </div>
            </div>
        `;
        document.querySelector('#admin-content').innerHTML = section;
    }

    async loadStats() {
        try {
            const response = await fetch('/admin/api/backup/stats');
            const stats = await response.json();
            this.displayStats(stats);
        } catch (error) {
            console.error('Error loading backup stats:', error);
        }
    }

    displayStats(stats) {
        const statsHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>User Backups</h4>
                    <p>Total Backups: ${stats.users.total_backups}</p>
                    <p>Total Users: ${stats.users.total_users}</p>
                    <p>Latest: ${stats.users.latest_backup}</p>
                </div>
                <div class="stat-card">
                    <h4>Tick Backups</h4>
                    <p>Total Backups: ${stats.ticks.total_backups}</p>
                    <p>Markets: ${Array.from(stats.ticks.markets_covered).join(', ')}</p>
                    <p>Retention: ${stats.ticks.retention_days} days</p>
                </div>
            </div>
        `;
        document.querySelector('#backup-stats').innerHTML = statsHtml;
    }

    async searchUserHistory() {
        const username = document.querySelector('#username-search').value;
        try {
            const response = await fetch(`/admin/api/user/history/${username}`);
            const history = await response.json();
            this.displayUserHistory(history);
        } catch (error) {
            console.error('Error searching user history:', error);
        }
    }

    displayUserHistory(history) {
        const historyHtml = history.map(entry => `
            <div class="history-entry">
                <h4>Backup: ${entry.backup_date}</h4>
                <p>Email: ${entry.email}</p>
                <p>Admin: ${entry.is_admin}</p>
                <button onclick="backupManager.prepareRestore('${entry.username}', '${entry.backup_date}')">
                    Restore to this point
                </button>
            </div>
        `).join('');
        document.querySelector('#user-history-results').innerHTML = historyHtml;
    }

    async prepareRestore(username, backupDate) {
        document.querySelector('#restore-username').value = username;
        const select = document.querySelector('#backup-select');
        select.innerHTML = `<option value="${backupDate}">Backup from ${backupDate}</option>`;
    }

    async restoreUser() {
        const username = document.querySelector('#restore-username').value;
        const backupSha = document.querySelector('#backup-select').value;
        
        try {
            const response = await fetch('/admin/api/user/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ username, backup_sha: backupSha })
            });
            
            const result = await response.json();
            if (result.success) {
                alert('User restored successfully!');
                this.searchUserHistory();
            } else {
                alert('Error restoring user: ' + result.message);
            }
        } catch (error) {
            console.error('Error restoring user:', error);
        }
    }
}

// Initialize backup manager
const backupManager = new BackupManager(); 