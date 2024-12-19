document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const tabId = this.getAttribute('data-tab');
                
                navItems.forEach(nav => nav.classList.remove('active'));
                this.classList.add('active');
                
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                    if (content.id === tabId) {
                        content.classList.remove('hidden');
                    }
                });
            }
        });
    });

    // User management functionality
    const editButtons = document.querySelectorAll('.action-btn.edit');
    const deleteButtons = document.querySelectorAll('.action-btn.delete');

    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            // Implement edit user functionality
            console.log('Edit user:', userId);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            if (confirm('Are you sure you want to delete this user?')) {
                // Implement delete user functionality
                console.log('Delete user:', userId);
            }
        });
    });

    // Log filtering functionality
    const logLevel = document.getElementById('logLevel');
    const logDate = document.getElementById('logDate');
    const logEntries = document.querySelectorAll('.log-entry');

    logLevel.addEventListener('change', filterLogs);
    logDate.addEventListener('change', filterLogs);

    function filterLogs() {
        const level = logLevel.value;
        const date = logDate.value;

        logEntries.forEach(entry => {
            if (level === 'all' || entry.classList.contains(level)) {
                entry.style.display = 'block';
            } else {
                entry.style.display = 'none';
            }
        });
    }

    // Sidebar drag functionality
    const sidebar = document.querySelector('.sidebar');
    const dragHandle = document.querySelector('.sidebar-drag');
    let isResizing = false;
    let lastDownX = 0;

    function initDrag(e) {
        isResizing = true;
        lastDownX = e.clientX;
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        sidebar.style.transition = 'none';
    }

    function doDrag(e) {
        if (!isResizing) return;

        const delta = e.clientX - lastDownX;
        const newWidth = sidebar.offsetWidth + delta;

        if (newWidth >= 180 && newWidth <= 400) {
            sidebar.style.width = newWidth + 'px';
            lastDownX = e.clientX;
        }
    }

    function stopDrag() {
        isResizing = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
        sidebar.style.transition = 'width 0.3s';
    }

    // Add drag handle to sidebar
    const handle = document.createElement('div');
    handle.className = 'sidebar-drag';
    sidebar.appendChild(handle);
    handle.addEventListener('mousedown', initDrag);

    // Double click to reset width
    sidebar.addEventListener('dblclick', function(e) {
        if (e.target === handle) {
            sidebar.style.width = '220px';
        }
    });

    // Add hover effect to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseover', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 0 25px rgba(255, 42, 109, 0.4)';
        });
        
        card.addEventListener('mouseout', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 0 15px rgba(255, 42, 109, 0.2)';
        });
    });

    // Add this to your existing DOMContentLoaded event handler
    class AdminChatManager {
        constructor() {
            this.initializeElements();
            this.initializeEventListeners();
            this.activeChats = new Map();
            this.selectedUser = null;
            this.ws = null;
            this.connectWebSocket();
        }

        connectWebSocket() {
            const socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            socket.on('connect', () => {
                console.log('Connected to chat server');
                this.addMessage('Connected to support chat', 'system');
            });

            socket.on('connect_error', (error) => {
                console.log('Connection error:', error);
                this.addMessage('Connection error. Trying alternative method...', 'system');
            });

            // ... rest of the socket event handlers
        }

        handleIncomingMessage(data) {
            const { userId, content, timestamp } = data;
            if (!this.activeChats.has(userId)) {
                this.addUser({
                    id: userId,
                    username: data.username,
                    unread: 1
                });
            }

            const chatHistory = this.activeChats.get(userId);
            chatHistory.messages.push({
                content,
                timestamp,
                sender: 'user'
            });

            if (this.selectedUser === userId) {
                this.addMessageToChat(content, 'user', timestamp);
            } else {
                this.incrementUnreadCount(userId);
            }
        }

        sendMessage(content) {
            if (!this.selectedUser || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            const messageData = {
                type: 'admin_message',
                userId: this.selectedUser,
                content,
                timestamp: new Date().toISOString()
            };

            this.ws.send(JSON.stringify(messageData));
            this.addMessageToChat(content, 'admin');
        }

        initializeElements() {
            this.chatUsers = document.getElementById('chat-users');
            this.chatMessages = document.getElementById('admin-chat-messages');
            this.chatForm = document.getElementById('admin-chat-form');
            this.chatInput = document.getElementById('admin-chat-input');
            this.userSearch = document.getElementById('user-search');
            this.selectedUserElement = document.getElementById('selected-user');
        }

        initializeEventListeners() {
            this.chatForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });

            this.userSearch?.addEventListener('input', (e) => {
                this.filterUsers(e.target.value);
            });

            // Simulate receiving new messages
            setInterval(() => {
                this.checkNewMessages();
            }, 5000);
        }

        addUser(userData) {
            const userElement = document.createElement('div');
            userElement.className = 'chat-user-item';
            userElement.dataset.userId = userData.id;
            
            userElement.innerHTML = `
                <div class="user-name">${userData.username}</div>
                <div class="last-message">${userData.lastMessage || 'No messages yet'}</div>
                ${userData.unread ? '<span class="unread-badge">' + userData.unread + '</span>' : ''}
            `;

            userElement.addEventListener('click', () => this.selectUser(userData));
            this.chatUsers.appendChild(userElement);
            this.activeChats.set(userData.id, userData);
        }

        selectUser(userData) {
            this.selectedUser = userData;
            
            // Update UI
            document.querySelectorAll('.chat-user-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector(`[data-user-id="${userData.id}"]`)?.classList.add('active');
            
            // Enable chat input
            this.chatInput.disabled = false;
            this.chatInput.placeholder = `Message ${userData.username}...`;
            document.querySelector('.send-btn').disabled = false;
            
            // Update user info
            this.selectedUserElement.textContent = userData.username;
            this.updateUserDetails(userData);
            
            // Load chat history
            this.loadChatHistory(userData.id);
        }

        sendMessage() {
            if (!this.selectedUser || !this.chatInput.value.trim()) return;

            const message = {
                content: this.chatInput.value.trim(),
                timestamp: new Date(),
                sender: 'admin'
            };

            this.addMessageToChat(message);
            this.chatInput.value = '';
        }

        addMessageToChat(message) {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.sender}`;
            
            messageElement.innerHTML = `
                <div class="message-content">${message.content}</div>
                <div class="message-time">${message.timestamp.toLocaleTimeString()}</div>
            `;

            this.chatMessages.appendChild(messageElement);
            this.scrollToBottom();
        }

        scrollToBottom() {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }

        updateUserDetails(userData) {
            document.getElementById('detail-email').textContent = userData.email || '-';
            document.getElementById('detail-account-type').textContent = userData.accountType || '-';
            document.getElementById('detail-api-status').textContent = userData.apiStatus || '-';
            document.getElementById('detail-join-date').textContent = userData.joinDate || '-';
        }

        // Simulate receiving new messages
        checkNewMessages() {
            if (Math.random() > 0.7) { // 30% chance of new message
                const mockMessage = {
                    content: 'This is a simulated user message.',
                    timestamp: new Date(),
                    sender: 'user'
                };
                if (this.selectedUser) {
                    this.addMessageToChat(mockMessage);
                }
            }
        }

        filterUsers(searchTerm) {
            const users = document.querySelectorAll('.chat-user-item');
            users.forEach(user => {
                const username = user.querySelector('.user-name').textContent.toLowerCase();
                if (username.includes(searchTerm.toLowerCase())) {
                    user.style.display = 'block';
                } else {
                    user.style.display = 'none';
                }
            });
        }
    }

    // Initialize admin chat
    const adminChat = new AdminChatManager();

    // Add some mock users for testing
    adminChat.addUser({
        id: 1,
        username: 'User1',
        email: 'user1@example.com',
        accountType: 'Demo',
        apiStatus: 'Connected',
        joinDate: '2024-01-01',
        unread: 2
    });

    adminChat.addUser({
        id: 2,
        username: 'User2',
        email: 'user2@example.com',
        accountType: 'Real',
        apiStatus: 'Pending',
        joinDate: '2024-02-15',
        lastMessage: 'Need help with API setup'
    });

    // Add this after your existing AdminChatManager class

    class BackupManager {
        constructor() {
            console.log('BackupManager initialized'); // Debug log
            this.initializeElements();
            this.attachEventListeners();
            this.loadBackupStatus();
        }

        initializeElements() {
            // Get button elements
            this.triggerBackupBtn = document.getElementById('trigger-backup');
            this.restoreBackupBtn = document.getElementById('restore-backup');
            this.scheduleBackupBtn = document.getElementById('schedule-backup');
            
            // Get display elements
            this.statusBadge = document.getElementById('backup-status');
            this.lastBackupTime = document.getElementById('last-backup-time');
            this.backupSize = document.getElementById('backup-size');
            this.backupCount = document.getElementById('backup-count');
            this.backupLogs = document.getElementById('backup-logs');

            // Debug log
            console.log('Buttons found:', {
                trigger: !!this.triggerBackupBtn,
                restore: !!this.restoreBackupBtn,
                schedule: !!this.scheduleBackupBtn
            });
        }

        attachEventListeners() {
            // Direct click handlers
            if (this.triggerBackupBtn) {
                this.triggerBackupBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log('Create backup clicked');
                    this.createBackup();
                };
            }

            if (this.restoreBackupBtn) {
                this.restoreBackupBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log('Restore backup clicked');
                    this.restoreBackup();
                };
            }

            if (this.scheduleBackupBtn) {
                this.scheduleBackupBtn.onclick = (e) => {
                    e.preventDefault();
                    console.log('Schedule backup clicked');
                    this.scheduleBackup();
                };
            }
        }

        async createBackup() {
            try {
                console.log('Creating backup...'); // Debug log
                this.updateStatus('BACKING UP...');
                
                const response = await fetch('/admin/api/backup/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });
                
                const data = await response.json();
                console.log('Backup response:', data); // Debug log
                
                if (data.success) {
                    this.updateStatus('READY');
                    this.updateBackupInfo(data);
                    this.addBackupLog('Backup created successfully');
                    alert('Backup created successfully!');
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('Backup failed:', error);
                this.updateStatus('ERROR');
                this.addBackupLog('Backup failed: ' + error.message, 'error');
                alert('Backup failed: ' + error.message);
            }
        }

        async restoreBackup() {
            if (!confirm('Are you sure you want to restore from the latest backup? This will overwrite current data.')) {
                return;
            }

            try {
                console.log('Restoring backup...'); // Debug log
                this.updateStatus('RESTORING...');
                
                const response = await fetch('/admin/api/backup/restore', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });
                
                const data = await response.json();
                console.log('Restore response:', data); // Debug log
                
                if (data.success) {
                    this.updateStatus('READY');
                    this.addBackupLog('Backup restored successfully');
                    alert('Backup restored successfully!');
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('Restore failed:', error);
                this.updateStatus('ERROR');
                this.addBackupLog('Restore failed: ' + error.message, 'error');
                alert('Restore failed: ' + error.message);
            }
        }

        scheduleBackup() {
            console.log('Opening schedule dialog...'); // Debug log
            const modal = document.createElement('div');
            modal.className = 'cyber-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Schedule Backup</h3>
                    <form id="schedule-backup-form">
                        <div class="form-group">
                            <label>Frequency</label>
                            <select id="backup-frequency">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Time (24h)</label>
                            <input type="time" id="backup-time" value="00:00">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="cyber-button">Save</button>
                            <button type="button" class="cyber-button" onclick="this.closest('.cyber-modal').remove()">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            const form = modal.querySelector('#schedule-backup-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch('/admin/api/backup/schedule', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            frequency: modal.querySelector('#backup-frequency').value,
                            time: modal.querySelector('#backup-time').value
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        this.addBackupLog(`Scheduled backup: ${data.frequency} at ${data.time}`);
                        modal.remove();
                        alert('Backup scheduled successfully!');
                    }
                } catch (error) {
                    console.error('Failed to schedule backup:', error);
                    alert('Failed to schedule backup: ' + error.message);
                }
            };
        }

        updateStatus(status) {
            if (this.statusBadge) {
                this.statusBadge.textContent = status;
                this.statusBadge.className = `status-badge status-${status.toLowerCase()}`;
            }
        }

        updateBackupInfo(data) {
            if (this.lastBackupTime) this.lastBackupTime.textContent = data.lastBackup || 'Never';
            if (this.backupSize) this.backupSize.textContent = data.size || '0 MB';
            if (this.backupCount) this.backupCount.textContent = data.count || '0';
        }

        addBackupLog(message, type = 'info') {
            if (this.backupLogs) {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${type}`;
                logEntry.innerHTML = `
                    <span class="timestamp">${new Date().toLocaleTimeString()}</span>
                    <span class="message">${message}</span>
                `;
                this.backupLogs.insertBefore(logEntry, this.backupLogs.firstChild);
            }
        }

        async loadBackupStatus() {
            try {
                const response = await fetch('/admin/api/backup/status');
                const data = await response.json();
                if (data.success) {
                    this.updateBackupInfo(data);
                    this.updateStatus('READY');
                }
            } catch (error) {
                console.error('Failed to load backup status:', error);
                this.updateStatus('ERROR');
            }
        }
    }

    // Initialize backup manager when document is ready
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Initializing BackupManager...'); // Debug log
        window.backupManager = new BackupManager();
    });

    // AI Control Tab Functionality
    const aiControlTab = document.querySelector('[data-tab="ai-control"]');
    aiControlTab?.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });
        
        // Show AI Control content
        const aiControlContent = document.getElementById('ai-control');
        if (aiControlContent) {
            aiControlContent.classList.remove('hidden');
        }
        
        // Update active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        this.classList.add('active');
        
        // Initialize backup manager if not already initialized
        if (!window.backupManager) {
            window.backupManager = new BackupManager();
        }
    });

    // Add click handlers for the cyber-buttons in AI Control
    document.querySelectorAll('.cyber-button').forEach(button => {
        button.addEventListener('click', async function(e) {
            const action = this.id;
            
            switch(action) {
                case 'sync-github':
                    if (window.backupManager) {
                        await window.backupManager.syncWithGithub();
                    }
                    break;
                    
                case 'trigger-backup':
                    if (window.backupManager) {
                        await window.backupManager.createBackup();
                    }
                    break;
                    
                case 'restore-backup':
                    if (window.backupManager) {
                        await window.backupManager.restoreBackup();
                    }
                    break;
                    
                case 'schedule-backup':
                    if (window.backupManager) {
                        window.backupManager.showScheduleDialog();
                    }
                    break;
                    
                case 'clear-backup-logs':
                    if (window.backupManager) {
                        await window.backupManager.clearBackupLogs();
                    }
                    break;
                    
                case 'export-backup-logs':
                    if (window.backupManager) {
                        window.backupManager.exportBackupLogs();
                    }
                    break;
                    
                case 'view-commits':
                    if (window.backupManager) {
                        window.backupManager.viewCommitHistory();
                    }
                    break;
                    
                case 'configure-repo':
                    if (window.backupManager) {
                        window.backupManager.showRepoConfig();
                    }
                    break;
            }
        });
    });

    // Update status badges periodically
    setInterval(() => {
        if (window.backupManager) {
            window.backupManager.updateStatus();
        }
    }, 30000);

    // GitHub Integration Functionality
    class GitHubManager {
        constructor() {
            this.initializeElements();
            this.attachEventListeners();
            this.updateStatus();
        }

        initializeElements() {
            this.statusBadge = document.getElementById('github-status');
            this.syncButton = document.getElementById('sync-github');
            this.viewCommitsButton = document.getElementById('view-commits');
            this.configureRepoButton = document.getElementById('configure-repo');
            this.repoNameElement = document.getElementById('repo-name');
            this.lastSyncElement = document.getElementById('last-sync-time');
            this.branchElement = document.getElementById('current-branch');
            this.syncStatusElement = document.getElementById('sync-status');
        }

        attachEventListeners() {
            this.syncButton?.addEventListener('click', () => this.syncWithGithub());
            this.viewCommitsButton?.addEventListener('click', () => this.viewCommits());
            this.configureRepoButton?.addEventListener('click', () => this.configureRepo());
        }

        async syncWithGithub() {
            try {
                this.updateStatus('SYNCING');
                const response = await fetch('/admin/api/github/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                    }
                });
                
                const data = await response.json();
                if (data.success) {
                    this.updateStatus('CONNECTED');
                    this.updateInfo({
                        repository: data.repository,
                        lastSync: new Date().toLocaleString(),
                        branch: data.branch,
                        status: 'Live data streaming'
                    });
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('GitHub sync failed:', error);
                this.updateStatus('ERROR');
            }
        }

        async viewCommits() {
            try {
                const response = await fetch('/admin/api/github/commits');
                const data = await response.json();
                if (data.success) {
                    // Create a modal to display commits
                    const modal = document.createElement('div');
                    modal.className = 'cyber-modal';
                    modal.innerHTML = `
                        <div class="modal-content">
                            <h3>Recent Commits</h3>
                            <div class="commits-list">
                                ${data.commits.map(commit => `
                                    <div class="commit-item">
                                        <div class="commit-message">${commit.message}</div>
                                        <div class="commit-info">
                                            <span>${commit.author}</span>
                                            <span>${new Date(commit.date).toLocaleString()}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <button class="cyber-button" onclick="this.parentElement.parentElement.remove()">Close</button>
                        </div>
                    `;
                    document.body.appendChild(modal);
                }
            } catch (error) {
                console.error('Failed to fetch commits:', error);
            }
        }

        configureRepo() {
            const modal = document.createElement('div');
            modal.className = 'cyber-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Configure GitHub Repository</h3>
                    <form id="repo-config-form">
                        <div class="form-group">
                            <label>Repository Name</label>
                            <input type="text" id="repo-name-input" value="${this.repoNameElement.textContent}">
                        </div>
                        <div class="form-group">
                            <label>Branch</label>
                            <input type="text" id="branch-input" value="${this.branchElement.textContent}">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="cyber-button">Save</button>
                            <button type="button" class="cyber-button" onclick="this.closest('.cyber-modal').remove()">Cancel</button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('form').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch('/admin/api/github/configure', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            repository: modal.querySelector('#repo-name-input').value,
                            branch: modal.querySelector('#branch-input').value
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        this.updateInfo(data);
                        modal.remove();
                    }
                } catch (error) {
                    console.error('Failed to configure repository:', error);
                }
            });
        }

        updateStatus(status) {
            if (this.statusBadge) {
                this.statusBadge.textContent = status;
                this.statusBadge.className = `status-badge status-${status.toLowerCase()}`;
            }
        }

        updateInfo(data) {
            if (this.repoNameElement) this.repoNameElement.textContent = data.repository;
            if (this.lastSyncElement) this.lastSyncElement.textContent = data.lastSync;
            if (this.branchElement) this.branchElement.textContent = data.branch;
            if (this.syncStatusElement) this.syncStatusElement.textContent = data.status;
        }

        updateStatus() {
            // Initial status check
            fetch('/admin/api/github/status')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.updateInfo(data);
                        this.updateStatus(data.status);
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch GitHub status:', error);
                    this.updateStatus('ERROR');
                });
        }
    }

    // Initialize GitHub manager
    const githubManager = new GitHubManager();

    // Update or add this class to your admin_dashboard.js
    class TickManager {
        constructor() {
            this.syncInterval = null;
            this.lastSync = Date.now();
            this.markets = ['forex', 'crypto']; // Add your markets here
            this.initSync();
        }

        async initSync() {
            // Only start sync if we're on a page that needs it
            if (document.getElementById('trading-view') || document.getElementById('market-data')) {
                this.startSync();
            }
        }

        startSync() {
            // Clear any existing interval
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            // Set up new sync interval (every 5 seconds)
            this.syncInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/ticks/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            markets: this.markets,
                            lastSync: this.lastSync
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Tick sync failed');
                    }
                    
                    const data = await response.json();
                    if (data.ticks && data.ticks.length > 0) {
                        this.updateTicks(data.ticks);
                        this.lastSync = Date.now();
                    }
                } catch (error) {
                    console.error('Tick sync error:', error);
                    // Don't stop sync on error, just log it
                }
            }, 5000); // 5 second interval
        }

        stopSync() {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
        }

        updateTicks(ticks) {
            // Update your UI with new tick data
            const tickEvent = new CustomEvent('ticksUpdated', { detail: ticks });
            document.dispatchEvent(tickEvent);
        }
    }

    // Initialize tick manager only when needed
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize if we're on a page that needs tick data
        if (document.getElementById('trading-view') || document.getElementById('market-data')) {
            window.tickManager = new TickManager();
        }
    });
}); 