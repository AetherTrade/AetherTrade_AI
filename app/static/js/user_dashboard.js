function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

class DerivAPI {
    constructor() {
        this.ws = null;
        this.token = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.priceHistory = [];  // Store price history for MA calculation
        this.MA_PERIOD = 50;     // MA period length
        this.derivEmail = null;
        this.derivCountry = null;
        this.landingCompany = null;
        this.lastBalance = 0;
        this.initialBalance = 0;
        this.isBalanceInitialized = false;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Deriv API...');
            const response = await fetch('/deriv-api/get-token');
            const data = await response.json();
            console.log('Token response:', data);

            if (data.success && data.token) {
                this.token = data.token;
                console.log('Token found, connecting...');
                this.connect();
            } else {
                console.log('No API key found, redirecting to setup...');
                window.location.href = '/auth/setup-api';
            }
        } catch (error) {
            console.error('Failed to initialize Deriv API:', error);
            window.location.href = '/auth/setup-api';
        }
    }

    connect() {
        console.log('Connecting to WebSocket...');
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

        this.ws.onopen = () => {
            console.log('WebSocket connected, authorizing...');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.authorize();
        };

        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            this.handleMessage(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket closed');
            this.connected = false;
            this.handleDisconnect();
        };
    }

    authorize() {
        console.log('Sending authorize request...');
        this.ws.send(JSON.stringify({
            authorize: this.token
        }));
    }

    handleMessage(data) {
        if (data.msg_type === 'authorize') {
            if (data.error) {
                console.error('Authorization failed:', data.error);
                document.getElementById('account-balance').textContent = 'Auth Failed';
                return;
            }
            console.log('Authorization successful:', data.authorize);
            
            this.derivEmail = data.authorize.email;
            this.derivCountry = data.authorize.country;
            this.landingCompany = data.authorize.landing_company_name;
            
            this.updateDerivAccountInfo();
            
            this.updateAccountType(data.authorize.is_virtual);
            this.checkRealAccountApproval(data.authorize);
            this.getAccountInfo();
            this.subscribeToBalance();
            this.subscribeToOpenContracts();
            this.getProfitTable();
            this.subscribeToR50Ticks();
            this.accountEmail = data.authorize.email;
            this.joinDate = new Date(data.authorize.landing_company_join_date * 1000);
            this.updateProfileInfo();

            // Update account notice based on account type
            const warningNotice = document.getElementById('account-notice');
            const successNotice = document.getElementById('account-approved');
            
            if (data.authorize.is_virtual) {
                warningNotice.style.display = 'block';
                successNotice.style.display = 'none';
            } else {
                warningNotice.style.display = 'none';
                successNotice.style.display = 'block';
            }
        }
        else if (data.error) {
            // Only log specific error types that need attention
            if (data.error.code === 'InvalidToken') {
                console.error('Invalid API token, redirecting to setup...');
                window.location.href = '/auth/setup-api';
            }
            // Don't log UnrecognisedRequest errors
            else if (data.error.code !== 'UnrecognisedRequest') {
                console.error('WebSocket error message:', data.error);
            }
        }
        else if (data.msg_type === 'balance') {
            if (data.balance) {
                this.updateBalance(data.balance);
            }
        }
        else if (data.msg_type === 'profit_table') {
            if (!data.error) {
                this.updateProfitLoss(data.profit_table);
            }
        }
        else if (data.msg_type === 'proposal_open_contract') {
            if (!data.error) {
                this.updateOpenContracts(data.proposal_open_contract);
            }
        }
        else if (data.msg_type === 'statement') {
            if (!data.error) {
                this.updateTradeHistory(data.statement.transactions);
            }
        }
        else if (data.msg_type === 'active_symbols') {
            if (!data.error) {
                this.updateMarketInfo(data.active_symbols);
            }
        }
        else if (data.msg_type === 'tick') {
            if (data.tick && data.tick.symbol === 'R_50') {
                this.updateR50Gauge(data.tick);
            }
        }
        else if (data.msg_type === 'get_settings') {
            if (!data.error) {
                this.updateProfileSettings(data.get_settings);
            }
        }
    }

    getAccountInfo() {
        this.ws.send(JSON.stringify({
            get_account_info: 1
        }));
    }

    subscribeToBalance() {
        this.ws.send(JSON.stringify({
            balance: 1,
            subscribe: 1
        }));
    }

    updateBalance(data) {
        if (!data) return;
        
        const newBalance = parseFloat(data.balance).toFixed(2);
        
        // Initialize the initial balance if not done yet
        if (!this.isBalanceInitialized) {
            this.initialBalance = parseFloat(data.balance);
            this.isBalanceInitialized = true;
        }
        
        // Update balance display with animation
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement) {
            if (this.lastBalance !== newBalance) {
                balanceElement.classList.add('value-updated');
                setTimeout(() => balanceElement.classList.remove('value-updated'), 1000);
            }
            balanceElement.textContent = newBalance;
        }

        // Calculate and update profit/loss
        const profitLoss = parseFloat(data.balance) - this.initialBalance;
        const profitElement = document.getElementById('total-profit-loss');
        
        if (profitElement) {
            profitElement.textContent = `$${profitLoss.toFixed(2)}`;
            profitElement.className = `value ${profitLoss >= 0 ? 'positive' : 'negative'}`;
            if (this.lastBalance !== newBalance) {
                profitElement.classList.add('value-updated');
                setTimeout(() => profitElement.classList.remove('value-updated'), 1000);
            }
        }

        this.lastBalance = newBalance;
    }

    updateProfitLoss(data) {
        const totalPL = document.getElementById('total-profit-loss');
        const todayPL = document.getElementById('today-profit-loss');
        const winRate = document.getElementById('win-rate');

        if (data && data.profit_table && data.profit_table.transactions) {
            // Calculate total P/L
            const total = data.profit_table.transactions.reduce((sum, trade) => {
                return sum + parseFloat(trade.profit || 0);
            }, 0);

            // Calculate today's P/L
            const today = new Date().toISOString().split('T')[0];
            const todayTotal = data.profit_table.transactions
                .filter(trade => trade.purchase_time.startsWith(today))
                .reduce((sum, trade) => sum + parseFloat(trade.profit || 0), 0);

            // Calculate win rate
            const totalTrades = data.profit_table.transactions.length;
            const winningTrades = data.profit_table.transactions.filter(trade => parseFloat(trade.profit) > 0).length;
            const winRateValue = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;

            // Update DOM
            if (totalPL) {
                totalPL.textContent = `$${total.toFixed(2)}`;
                totalPL.className = `value ${total >= 0 ? 'positive' : 'negative'}`;
            }
            if (todayPL) {
                todayPL.textContent = `$${todayTotal.toFixed(2)}`;
                todayPL.className = `value ${todayTotal >= 0 ? 'positive' : 'negative'}`;
            }
            if (winRate) {
                winRate.textContent = `${winRateValue.toFixed(1)}%`;
            }
        }
    }

    updateOpenContracts(contract) {
        const openContractsElement = document.getElementById('open-contracts');
        if (!openContractsElement) return;

        let contractElement = document.getElementById(`contract-${contract.contract_id}`);
        if (!contractElement) {
            contractElement = document.createElement('div');
            contractElement.id = `contract-${contract.contract_id}`;
            contractElement.className = 'contract-item';
            contractElement.style.animation = 'fadeIn 0.5s ease-in-out';
            openContractsElement.appendChild(contractElement);
        }

        const profit = parseFloat(contract.profit || 0);
        contractElement.innerHTML = `
            <div class="contract-type">
                <i class="fas fa-chart-bar"></i>
                ${contract.contract_type}
            </div>
            <div class="contract-profit ${profit >= 0 ? 'positive' : 'negative'}">
                <i class="fas ${profit >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                ${profit.toFixed(2)}
            </div>
        `;
    }

    subscribeToOpenContracts() {
        this.ws.send(JSON.stringify({
            proposal_open_contract: 1,
            subscribe: 1
        }));
    }

    getProfitTable() {
        this.ws.send(JSON.stringify({
            profit_table: 1,
            description: 1,
            limit: 100,
            offset: 0
        }));
    }

    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), 5000);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    updateAccountType(isVirtual) {
        const accountTypeElement = document.getElementById('account-type');
        const accountStatusCard = document.getElementById('account-status-card');
        const accountStatusIcon = document.getElementById('account-status-icon');
        const accountStatusContent = document.getElementById('account-status-content');

        if (accountTypeElement) {
            const accountType = isVirtual ? 'Demo Account' : 'Real Account';
            accountTypeElement.textContent = accountType;
            accountTypeElement.className = `value ${isVirtual ? 'demo' : 'real'}`;
        }

        if (accountStatusContent) {
            if (isVirtual) {
                // Demo Account Content
                accountStatusCard.className = 'dashboard-card card';
                accountStatusIcon.className = 'fas fa-user-shield';
                accountStatusContent.innerHTML = `
                    <div class="upgrade-info">
                        <p>You are using a Demo Account</p>
                        <ul>
                            <li><i class="fas fa-info-circle"></i> Practice trading with virtual funds</li>
                            <li><i class="fas fa-chart-line"></i> Test strategies risk-free</li>
                            <li><i class="fas fa-arrow-up"></i> Upgrade to Real Account for live trading</li>
                        </ul>
                        <div class="action-buttons">
                            <button class="contact-admin-btn" onclick="window.location.href='{{ url_for('auth.admin_contact') }}'">
                                <i class="fas fa-envelope"></i> Contact Admin to Upgrade
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // Real Account Content
                accountStatusCard.className = 'dashboard-card card';
                accountStatusIcon.className = 'fas fa-user-shield';
                accountStatusContent.innerHTML = `
                    <div class="real-account-info">
                        <p>Welcome to your Real Trading Account! <span class="emoji">🚀</span></p>
                        <ul>
                            <li><i class="fas fa-check-circle"></i> Live Trading Enabled</li>
                            <li><i class="fas fa-shield-alt"></i> Full Account Protection</li>
                            <li><i class="fas fa-headset"></i> Priority Support Access</li>
                        </ul>
                    </div>
                `;
            }
        }
    }

    getTradeHistory() {
        this.ws.send(JSON.stringify({
            statement: 1,
            limit: 10,
            description: 1,
            sort: "DESC"
        }));
    }

    updateTradeHistory(transactions) {
        const historyElement = document.getElementById('trade-history');
        if (!historyElement) return;

        historyElement.innerHTML = transactions.map(trade => `
            <div class="trade-item">
                <div class="trade-info">
                    <span class="trade-type">${trade.action_type}</span>
                    <span class="trade-date">${new Date(trade.transaction_time * 1000).toLocaleString()}</span>
                </div>
                <div class="trade-amount ${parseFloat(trade.amount) >= 0 ? 'positive' : 'negative'}">
                    ${parseFloat(trade.amount).toFixed(2)}
                </div>
            </div>
        `).join('');
    }

    getMarketInfo() {
        this.ws.send(JSON.stringify({
            active_symbols: "brief",
            product_type: "basic"
        }));
    }

    updateMarketInfo(symbols) {
        const marketElement = document.getElementById('market-overview');
        if (!marketElement) return;

        const markets = symbols.reduce((acc, symbol) => {
            if (!acc[symbol.market]) {
                acc[symbol.market] = [];
            }
            acc[symbol.market].push(symbol);
            return acc;
        }, {});

        marketElement.innerHTML = Object.entries(markets).map(([market, symbols]) => `
            <div class="market-section">
                <h4>${market}</h4>
                <div class="symbol-grid">
                    ${symbols.slice(0, 4).map(symbol => `
                        <div class="symbol-item">
                            <span class="symbol-name">${symbol.display_name}</span>
                            <span class="symbol-price">${symbol.spot}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    subscribeToR50Ticks() {
        console.log('Subscribing to R_50 ticks...');
        this.ws.send(JSON.stringify({
            ticks: 'R_50',
            subscribe: 1
        }));
    }

    calculateMA(prices) {
        if (prices.length < this.MA_PERIOD) return null;
        const relevantPrices = prices.slice(-this.MA_PERIOD);
        const sum = relevantPrices.reduce((a, b) => a + b, 0);
        return sum / this.MA_PERIOD;
    }

    updateR50Gauge(tick) {
        const gaugeElement = document.getElementById('r50-gauge');
        if (!gaugeElement) return;

        const currentPrice = parseFloat(tick.quote);
        this.priceHistory.push(currentPrice);
        
        if (this.priceHistory.length > this.MA_PERIOD * 2) {
            this.priceHistory.shift();
        }

        const currentMA = this.calculateMA(this.priceHistory);
        const prevMA = this.priceHistory.length > this.MA_PERIOD + 1 ? 
            this.calculateMA(this.priceHistory.slice(0, -1)) : currentMA;

        let maTrend = 0;
        if (currentMA && prevMA) {
            maTrend = ((currentMA - prevMA) / prevMA) * 100;
        }

        const rotation = Math.min(Math.max(maTrend * 10, -90), 90);

        gaugeElement.innerHTML = `
            <div class="gauge-container">
                <div class="gauge">
                    <div class="gauge-needle" style="transform: rotate(${rotation}deg)"></div>
                    <div class="gauge-value">
                        <div class="price">${currentPrice.toFixed(4)}</div>
                        <div class="ma-value">MA(50): ${currentMA ? currentMA.toFixed(4) : 'Calculating...'}</div>
                    </div>
                    <div class="gauge-change ${maTrend >= 0 ? 'positive' : 'negative'}">
                        Trend: ${maTrend ? (maTrend >= 0 ? '↑' : '↓') + ' ' + Math.abs(maTrend).toFixed(4) : '0.00'}%
                    </div>
                </div>
                <div class="gauge-labels">
                    <span>Strong Down</span>
                    <span>Neutral</span>
                    <span>Strong Up</span>
                </div>
            </div>
        `;
    }

    updateProfileInfo() {
        // Update email
        const emailElement = document.getElementById('user-email');
        if (emailElement && this.accountEmail) {
            emailElement.textContent = this.accountEmail;
            emailElement.classList.add('value-updated');
            setTimeout(() => emailElement.classList.remove('value-updated'), 1000);
        }

        // Update join date
        const joinDateElement = document.getElementById('join-date');
        if (joinDateElement && this.joinDate) {
            joinDateElement.textContent = this.joinDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            joinDateElement.classList.add('value-updated');
            setTimeout(() => joinDateElement.classList.remove('value-updated'), 1000);
        }

        // Update API status
        const apiStatusElement = document.getElementById('api-status');
        if (apiStatusElement) {
            const status = this.token ? 'Connected' : 'Not Connected';
            apiStatusElement.textContent = `API Status: ${status}`;
            apiStatusElement.className = `value ${status.toLowerCase().replace(' ', '-')}`;
            apiStatusElement.classList.add('value-updated');
            setTimeout(() => apiStatusElement.classList.remove('value-updated'), 1000);
        }

        // Update API verification details
        const apiLastVerifiedElement = document.getElementById('api-last-verified');
        if (apiLastVerifiedElement) {
            const lastVerified = this.token ? new Date().toLocaleString() : 'Never';
            apiLastVerifiedElement.textContent = lastVerified;
        }

        const apiApprovalStatusElement = document.getElementById('api-approval-status');
        if (apiApprovalStatusElement) {
            const approvalStatus = this.token ? 'Approved' : 'Pending';
            apiApprovalStatusElement.textContent = approvalStatus;
            apiApprovalStatusElement.className = `value ${approvalStatus.toLowerCase()}`;
        }
    }

    updateProfileSettings(settings) {
        // Update any additional settings from the get_settings call
        if (settings.email) {
            const emailElement = document.getElementById('user-email');
            if (emailElement) {
                emailElement.textContent = settings.email;
            }
        }

        // Add any additional profile settings you want to display
        console.log('Additional settings:', settings);
    }

    checkRealAccountApproval(authorizeData) {
        console.log('Checking real account approval:', authorizeData);
        
        const notificationCard = document.getElementById('api-notification-card');
        if (!notificationCard) {
            console.error('Notification card element not found');
            return;
        }

        notificationCard.style.display = 'block';
        notificationCard.style.opacity = '1';
        
        /*
        if (!authorizeData.is_virtual) {
            notificationCard.style.display = 'block';
            notificationCard.style.opacity = '1';
            console.log('Showing notification card');
        } else {
            notificationCard.style.display = 'none';
            console.log('Hiding notification card');
        }
        */
    }

    updateDerivAccountInfo() {
        // Update email
        const emailElement = document.getElementById('deriv-email');
        if (emailElement && this.derivEmail) {
            emailElement.textContent = this.derivEmail;
        }

        // Update country
        const countryElement = document.getElementById('deriv-country');
        if (countryElement && this.derivCountry) {
            // Convert country code to country name
            const countryName = new Intl.DisplayNames(['en'], {type: 'region'}).of(this.derivCountry);
            countryElement.textContent = countryName || this.derivCountry;
        }

        // Update landing company
        const landingCompanyElement = document.getElementById('deriv-landing-company');
        if (landingCompanyElement && this.landingCompany) {
            landingCompanyElement.textContent = this.landingCompany.toUpperCase();
        }
    }
}

class ChatManager {
    constructor() {
        this.chatForm = document.getElementById('chat-form');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
        this.ws = null;
        this.initializeChat();
        this.connectWebSocket();
    }

    connectWebSocket() {
        const socket = io({
            // Allow fallback to long-polling for PythonAnywhere
            transports: ['websocket', 'polling'],
            // Retry connection if failed
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

        socket.on('message', (message) => {
            if (message.type === 'message') {
                this.addMessage(message.content, message.sender);
            }
        });

        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.addMessage('Connection lost. Trying to reconnect...', 'system');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        });
    }

    initializeChat() {
        if (this.chatForm) {
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        if (this.chatInput) {
            // Auto resize textarea
            this.chatInput.addEventListener('input', () => {
                this.chatInput.style.height = 'auto';
                this.chatInput.style.height = this.chatInput.scrollHeight + 'px';
            });

            // Enter to send, Shift+Enter for new line
            this.chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const messageData = {
            type: 'message',
            content: message,
            timestamp: new Date().toISOString()
        };

        this.ws.send(JSON.stringify(messageData));
        this.addMessage(message, 'user');
        
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';
    }

    addMessage(content, type = 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const time = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${time}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Add entrance animation
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        requestAnimationFrame(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        });
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

class DashboardManager {
    constructor() {
        this.initializeNavigation();
        this.derivAPI = new DerivAPI();
        
        // Show dashboard view by default
        this.switchView('dashboard');
        this.initializeMobileHandlers();
        this.initializeRecommendations();
    }

    initializeNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(item.dataset.view);
            });
        });

        // Set dashboard nav item as active by default
        const dashboardNav = document.querySelector('.nav-item[data-view="dashboard"]');
        if (dashboardNav) {
            dashboardNav.classList.add('active');
        }
    }

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view-content').forEach(view => {
            view.style.display = 'none';
            view.classList.remove('active');
        });

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Show selected view
        const selectedView = document.getElementById(`${viewName}-view`);
        const selectedNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);

        if (selectedView) {
            selectedView.style.display = 'block';
            setTimeout(() => {
                selectedView.classList.add('active');
            }, 50);
        }

        if (selectedNav) {
            selectedNav.classList.add('active');
        }

        // Handle specific view initializations
        this.handleViewInit(viewName);
    }

    handleViewInit(viewName) {
        switch(viewName) {
            case 'dashboard':
                // Reinitialize or update dashboard data
                this.derivAPI.getAccountInfo();
                this.derivAPI.subscribeToBalance();
                this.derivAPI.subscribeToR50Ticks();
                break;
            case 'bot':
                if (!this.aetherBot) {
                    this.aetherBot = new AetherBot(this.derivAPI);
                    // Initialize bot view
                    this.aetherBot.initializeView();
                }
                break;
            case 'profile':
                this.initializeProfile();
                break;
            case 'settings':
                // Load settings
                console.log('Settings view initialized');
                break;
            case 'chat':
                if (!this.chatManager) {
                    this.chatManager = new ChatManager();
                }
                break;
        }
    }

    initializeProfile() {
        // Get the authorized account info from DerivAPI
        if (this.derivAPI && this.derivAPI.ws) {
            this.derivAPI.ws.send(JSON.stringify({
                "get_settings": 1,
                "req_id": 1000
            }));
        }
    }

    handlePasswordChange(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        fetch('/api/user/change-password', {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                this.showNotification('Password updated successfully', 'success');
            } else {
                // Show error message
                this.showNotification(data.message || 'Failed to update password', 'error');
            }
        });
    }

    checkPasswordStrength(e) {
        const password = e.target.value;
        const strengthIndicator = e.target.parentElement.querySelector('.password-strength');
        
        // Password strength logic
        let strength = 0;
        if (password.match(/[a-z]/)) strength++;
        if (password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        if (password.length >= 8) strength++;

        const strengthText = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
        const strengthColor = ['#ff4444', '#ffaa44', '#ffff44', '#44ff44', '#44ffff'];

        strengthIndicator.textContent = strengthText[strength - 1] || '';
        strengthIndicator.style.color = strengthColor[strength - 1] || '';
    }

    showNotification(message, type) {
        // Add notification implementation
        console.log(`${type}: ${message}`);
    }

    initializeMobileHandlers() {
        // Handle touch events
        const touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;

            // Swipe handling for mobile navigation
            if (Math.abs(diff) > 100) {
                if (diff > 0) {
                    // Swipe left
                    this.handleSwipeLeft();
                } else {
                    // Swipe right
                    this.handleSwipeRight();
                }
            }
        });
    }

    initializeRecommendations() {
        // Check account balance and show appropriate recommendation message
        const balanceElement = document.getElementById('account-balance');
        if (balanceElement) {
            const balance = parseFloat(balanceElement.textContent);
            const recommendationCard = document.querySelector('.recommendation-card');
            
            if (recommendationCard && balance < 100) {
                recommendationCard.classList.add('highlight-recommendation');
                // Add a subtle animation to draw attention
                setTimeout(() => {
                    recommendationCard.classList.remove('highlight-recommendation');
                }, 2000);
            }
        }
    }
}

function updateSuggestedStake(balance) {
    const minStake = 0.35;
    const suggestedPercentage = 0.0035; // 0.35%
    
    let suggestedStake = balance * suggestedPercentage;
    
    // If suggested stake is less than minimum, use minimum
    if (suggestedStake < minStake) {
        suggestedStake = minStake;
    }
    
    const suggestedStakeElement = document.getElementById('suggested-stake');
    if (suggestedStakeElement) {
        suggestedStakeElement.textContent = `$${suggestedStake.toFixed(2)}`;
        
        // Add explanation if using minimum stake
        const balancePercentageElement = document.getElementById('balance-percentage');
        if (balancePercentageElement) {
            if (suggestedStake === minStake) {
                balancePercentageElement.textContent = 'Minimum allowed stake';
            } else {
                balancePercentageElement.textContent = '0.35% of balance';
            }
        }
    }
}

// Call this when account balance is updated
document.addEventListener('DOMContentLoaded', () => {
    // Initial calculation when balance is first loaded
    const balanceElement = document.getElementById('account-balance');
    if (balanceElement) {
        const balanceObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const balance = parseFloat(balanceElement.textContent.replace(/[^0-9.-]+/g, ''));
                    if (!isNaN(balance)) {
                        updateSuggestedStake(balance);
                    }
                }
            });
        });

        balanceObserver.observe(balanceElement, { childList: true });
    }
});

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
}); 