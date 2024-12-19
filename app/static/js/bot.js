class AetherBot {
    constructor(derivAPI) {
        this.derivAPI = derivAPI;
        this.isRunning = false;
        this.isTrading = false;
        this.tradeLockTimeout = 60000;
        this.minTimeBetweenTrades = 2000;
        this.lastTradeTime = 0;
        this.tradeCooldown = false;
        this.cooldownTimer = null;
        this.selectedMarket = "R_50";
        this.availableMarkets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
        this.initialStake = 0.35;
        this.currentStake = this.initialStake;
        this.martingaleMultiplier = 2;
        this.maxLosses = 10;
        this.consecutiveLosses = 0;
        this.activityLog = [];
        this.maxLogEntries = 100;

        // Add reconnection properties
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.reconnectTimer = null;

        // Initialize stats object with profit tracking
        this.marketConfig = {
            'R_10': { minStake: 0.35, maxStake: 50000, description: 'Volatility 10 Index' },
            'R_25': { minStake: 0.35, maxStake: 50000, description: 'Volatility 25 Index' },
            'R_50': { minStake: 0.35, maxStake: 50000, description: 'Volatility 50 Index' },
            'R_75': { minStake: 0.35, maxStake: 50000, description: 'Volatility 75 Index' },
            'R_100': { minStake: 0.35, maxStake: 50000, description: 'Volatility 100 Index' }
        };

        // Add market-specific settings
        this.marketSettings = {
            'R_10': { timeframe: 60, threshold: 0.5 },  // More conservative settings for lower volatility
            'R_25': { timeframe: 45, threshold: 0.6 },
            'R_50': { timeframe: 30, threshold: 0.7 },  // Default settings
            'R_75': { timeframe: 20, threshold: 0.8 },
            'R_100': { timeframe: 15, threshold: 0.9 }  // More aggressive settings for higher volatility
        };

        this.currentProfit = 0;  // Initialize current profit tracking

        // Add trading statistics
        this.stats = {
            totalProfit: 0,
            winCount: 0,
            lossCount: 0,
            totalTrades: 0,
            winRate: 0,
            lossRate: 0
        };

        // Add profit management settings
        this.profitSettings = {
            takeProfit: 10,
            stopLoss: 5
        };
        
        this.sessionStats = {
            totalProfit: 0,
            highestProfit: 0,
            lowestProfit: 0,
            lastTradeProfit: 0
        };

        this.initializeStrategy();
        this.setupEventListeners();
        this.initializeActivityLog();
        this.initializeWebSocket();
        this.initializeMarketSubscriptions();

        // Add button references
        this.startButton = document.getElementById('start-bot');
        this.stopButton = document.getElementById('stop-bot');
        
        // Initialize button states
        this.updateButtonStates();
    }

    async initializeWebSocket() {
        try {
            // Get the API token from the server
            const response = await fetch('/deriv-api/get-token');
            const data = await response.json();
            
            if (!data.success || !data.token) {
                this.logActivity('Failed to get API token', 'error');
                return;
            }

            // Initialize WebSocket connection
            const app_id = 1089; // Your Deriv App ID
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}`);
            
            this.ws.onopen = () => {
                this.logActivity('WebSocket connected', 'success');
                // Reset reconnection attempts on successful connection
                this.reconnectAttempts = 0;
                this.reconnectDelay = 5000;
                
                // Authorize with the API token
                this.ws.send(JSON.stringify({
                    authorize: data.token
                }));
            };

            this.ws.onmessage = (msg) => {
                const response = JSON.parse(msg.data);
                if (response.authorize) {
                    this.logActivity('API authorization successful', 'success');
                }
            };

            this.ws.onerror = (error) => {
                this.logActivity('WebSocket error: ' + error.message, 'error');
            };

            this.ws.onclose = () => {
                this.logActivity('WebSocket connection closed', 'warning');
                this.handleDisconnection();
            };

        } catch (error) {
            this.logActivity('Failed to initialize WebSocket: ' + error.message, 'error');
            this.handleDisconnection();
        }
    }

    handleDisconnection() {
        // Clear any existing reconnection timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        // Check if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            this.logActivity(
                `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay/1000}s...`, 
                'warning'
            );

            // Set timer for reconnection
            this.reconnectTimer = setTimeout(() => {
                this.initializeWebSocket();
                // Exponential backoff for next attempt
                this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000); // Max 30 seconds
            }, this.reconnectDelay);
        } else {
            this.logActivity('Max reconnection attempts reached. Please refresh the page.', 'error');
        }
    }

    async sendWSRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket is not connected'));
                return;
            }

            const msgId = Date.now();
            request.req_id = msgId;

            const responseHandler = (msg) => {
                const response = JSON.parse(msg.data);
                if (response.req_id === msgId) {
                    this.ws.removeEventListener('message', responseHandler);
                    resolve(response);
                }
            };

            this.ws.addEventListener('message', responseHandler);
            
            try {
                this.ws.send(JSON.stringify(request));
            } catch (error) {
                this.ws.removeEventListener('message', responseHandler);
                reject(error);
            }

            // Add timeout
            setTimeout(() => {
                this.ws.removeEventListener('message', responseHandler);
                reject(new Error('Request timeout'));
            }, 10000); // 10 second timeout
        });
    }

    async initializeStrategy() {
        try {
            const response = await fetch('/api/bot/strategy/settings');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new TypeError("Expected JSON response");
            }
            const settings = await response.json();
            this.strategy = settings;
            this.updateStrategyDisplay();
        } catch (error) {
            console.error('Failed to initialize strategy:', error);
            // Set default values if loading fails
            this.strategy = {
                shortEma: 3,
                longEma: 6,
                bbPeriod: 14,
                bbStd: 2.0,
                rsiPeriod: 7
            };
            this.updateStrategyDisplay();
        }
    }

    setupEventListeners() {
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        // Strategy controls
        addListener('short-ema', 'change', (e) => {
            this.updateStrategySetting('shortEma', parseInt(e.target.value));
        });
        addListener('long-ema', 'change', (e) => {
            this.updateStrategySetting('longEma', parseInt(e.target.value));
        });
        addListener('bb-period', 'change', (e) => {
            this.updateStrategySetting('bbPeriod', parseInt(e.target.value));
        });
        addListener('bb-std', 'change', (e) => {
            this.updateStrategySetting('bbStd', parseFloat(e.target.value));
        });
        addListener('rsi-period', 'change', (e) => {
            this.updateStrategySetting('rsiPeriod', parseInt(e.target.value));
        });

        // Trading controls
        addListener('stake-amount', 'change', (e) => {
            this.setStake(parseFloat(e.target.value));
        });
        addListener('martingale-multiplier', 'change', (e) => {
            this.martingaleMultiplier = Math.max(1, parseFloat(e.target.value));
            this.logActivity(`Martingale multiplier set to ${this.martingaleMultiplier}x`, 'info');
        });
        addListener('max-losses', 'change', (e) => {
            this.maxLosses = Math.max(1, parseInt(e.target.value));
            this.logActivity(`Max consecutive losses set to ${this.maxLosses}`, 'info');
        });
        addListener('market-select', 'change', (e) => {
            this.selectedMarket = e.target.value;
            this.getMarketAnalysis();
        });

        // Bot controls
        addListener('start-bot', 'click', () => this.start());
        addListener('stop-bot', 'click', () => this.stop());

        addListener('bot-type', 'change', (e) => {
            const botType = e.target.value;
            if (botType === 'random') {
                window.activeBot = window.randomBot;
            } else {
                window.activeBot = window.aetherBot;
            }
            this.logActivity(`Switched to ${botType} bot`, 'info');
        });

        // Add bot type switch listener
        const botTypeSelect = document.getElementById('bot-type');
        if (botTypeSelect) {
            botTypeSelect.addEventListener('change', (e) => {
                this.switchBotType(e.target.value);
            });
        }

        // Add Take Profit and Stop Loss listeners
        addListener('take-profit', 'change', (e) => {
            this.profitSettings.takeProfit = parseFloat(e.target.value);
            this.logActivity(`Take Profit set to $${this.profitSettings.takeProfit}`, 'info');
        });

        addListener('stop-loss', 'change', (e) => {
            this.profitSettings.stopLoss = parseFloat(e.target.value);
            this.logActivity(`Stop Loss set to $${this.profitSettings.stopLoss}`, 'info');
        });

        // Update button event listeners
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.start());
            // Add initial blink to start button
            this.startButton.classList.add('blink');
        }

        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stop());
        }
    }

    async updateStrategySetting(setting, value) {
        try {
            const response = await fetch('/api/bot/strategy/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...this.strategy,
                    [setting]: value
                })
            });
            if (!response.ok) throw new Error('Failed to update strategy settings');
            const result = await response.json();
            if (result.success) {
                this.strategy[setting] = value;
            }
        } catch (error) {
            console.error('Failed to update strategy setting:', error);
        }
    }

    updateStrategyDisplay() {
        if (!this.strategy) return;
        
        // Update strategy input fields
        const elements = {
            'short-ema': this.strategy.shortEma,
            'long-ema': this.strategy.longEma,
            'bb-period': this.strategy.bbPeriod,
            'bb-std': this.strategy.bbStd,
            'rsi-period': this.strategy.rsiPeriod
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) element.value = value;
        }
    }

    async getMarketAnalysis() {
        try {
            const response = await fetch(`/api/bot/analysis/${this.selectedMarket}`);
            if (!response.ok) {
                throw new Error('Failed to get market analysis');
            }
            const analysis = await response.json();
            
            if (analysis.signalStrength >= 75) {
                this.logActivity(`Strong signal detected: ${analysis.signalStrength}% ${analysis.trend}`, 'info');
            }
            
            return analysis;
        } catch (error) {
            this.logActivity(`Market analysis error: ${error.message}`, 'error');
            return null;
        }
    }

    updateAnalysisDisplay(analysis) {
        if (!analysis) return;

        const elements = {
            'strategy-trend': analysis.trend,
            'strategy-signal': `${parseFloat(analysis.signalStrength).toFixed(2)}%`,
            'strategy-phase': analysis.phase,
            'strategy-volatility': analysis.volatility
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                const valueSpan = element.querySelector('.value') || element;
                valueSpan.textContent = value;
                
                if (id === 'strategy-signal') {
                    const strength = parseFloat(analysis.signalStrength);
                    valueSpan.className = 'value ' + (
                        strength >= 75 ? 'high-probability' :
                        strength >= 50 ? 'medium-probability' :
                        'low-probability'
                    );
                }
            }
        }
    }

    async start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.updateButtonStates();
            this.logActivity('Bot started', 'success');
            await this.runBot();
        }
    }

    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            this.updateButtonStates();
            this.logActivity('Bot stopped', 'warning');
        }
    }

    async runBot() {
        while (this.isRunning) {
            try {
                let analysis = null;
                
                // Only process new signals if not currently trading
                if (!this.isTrading) {
                    // Get market analysis
                    analysis = await this.getMarketAnalysis();
                    
                    // Update display first
                    if (analysis) {
                        this.updateAnalysisDisplay(analysis);
                        
                        // Debug log to check signal strength
                        console.log('Current signal strength:', analysis.signalStrength);
                        
                        // Check signal strength and place trade if strong enough
                        if (parseFloat(analysis.signalStrength) >= 75) {
                            const tradeType = analysis.trend === 'Bullish' ? 'CALL' : 'PUT';
                            this.logActivity(`Strong signal detected: ${analysis.signalStrength}% ${analysis.trend}`, 'info');
                            
                            try {
                                // Updated: only pass direction
                                await this.placeTrade(tradeType);
                                this.logActivity(`Trade placed successfully: ${tradeType} on ${this.selectedMarket}`, 'success');
                            } catch (tradeError) {
                                this.logActivity(`Failed to place trade: ${tradeError.message}`, 'error');
                                console.error('Trade placement error:', tradeError);
                            }
                        } else {
                            this.logActivity(`Weak signal: ${analysis.signalStrength}% - No trade`, 'info');
                        }
                    } else {
                        this.logActivity('No analysis data available', 'warning');
                    }
                } else {
                    // If trading, just update the last analysis display
                    if (this.lastAnalysis) {
                        this.updateAnalysisDisplay(this.lastAnalysis);
                    }
                }
                
                // Store last analysis
                if (analysis) {
                    this.lastAnalysis = analysis;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Bot error:', error);
                this.logActivity('Bot encountered an error, waiting before retry', 'error');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    initializeActivityLog() {
        const logContainer = document.getElementById('activity-log');
        if (logContainer) {
            logContainer.innerHTML = '<div class="log-header">Activity Log</div>';
        }
    }

    async placeTrade(direction) {
        if (this.isTrading) {
            console.log('Trade already in progress, skipping...');
            return;
        }

        // Add signal strength check
        const analysis = await this.getMarketAnalysis();
        if (!analysis || parseFloat(analysis.signalStrength) < 75) {
            // Don't log weak signals in Overdrive mode
            this.logActivity(`Signal too weak for trade: ${analysis?.signalStrength || 0}%`, 'warning');
            return;
        }

        try {
            // Trade cooldown check
            const currentTime = Date.now();
            if (currentTime - this.lastTradeTime < this.minTimeBetweenTrades) {
                this.logActivity('Waiting for trade cooldown...', 'info');
                return;
            }

            this.isTrading = true;
            this.lastTradeTime = currentTime;

            // Place the trade
            const contract = await this.sendWSRequest({
                buy: 1,
                price: this.currentStake,
                parameters: {
                    contract_type: direction,
                    symbol: this.selectedMarket,
                    duration: 5,
                    duration_unit: 't',
                    basis: 'stake',
                    amount: this.currentStake,
                    currency: 'USD'
                }
            });

            if (contract.error) {
                throw new Error(contract.error.message);
            }

            this.activeContractId = contract.buy.contract_id;
            this.logActivity(`Trade placed successfully: ${direction} on ${this.selectedMarket}`, 'success');

            // Wait for trade completion with timeout
            await this.waitForTradeCompletion(this.activeContractId);

        } catch (error) {
            this.logActivity(`Trade error: ${error.message}`, 'error');
        } finally {
            this.releaseTradelock();
        }
    }

    async waitForTradeCompletion(contractId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Trade completion timeout'));
            }, this.tradeLockTimeout);

            const handleMessage = async (msg) => {
                try {
                    const data = JSON.parse(msg.data);
                    if (data.proposal_open_contract?.contract_id === contractId && 
                        data.proposal_open_contract.is_sold) {
                        cleanup();
                        await this.handleTradeCompletion(data.proposal_open_contract);
                        resolve(data.proposal_open_contract);
                    }
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                this.ws.removeEventListener('message', handleMessage);
            };

            // Subscribe to contract updates
            this.ws.addEventListener('message', handleMessage);
            
            // Send subscription request
            this.sendWSRequest({
                proposal_open_contract: 1,
                contract_id: contractId,
                subscribe: 1
            }).catch(error => {
                cleanup();
                reject(error);
            });
        });
    }

    async handleTradeCompletion(contract) {
        const profit = parseFloat(contract.profit);
        this.sessionStats.lastTradeProfit = profit;
        this.sessionStats.totalProfit += profit;
        
        // Update highest/lowest profit
        this.sessionStats.highestProfit = Math.max(this.sessionStats.highestProfit, this.sessionStats.totalProfit);
        this.sessionStats.lowestProfit = Math.min(this.sessionStats.lowestProfit, this.sessionStats.totalProfit);

        // Check profit limits
        if (this.checkProfitLimits()) {
            this.stop();
            return;
        }

        // Update stats display
        this.updateStatsDisplay();
    }

    checkProfitLimits() {
        if (this.sessionStats.totalProfit >= this.profitSettings.takeProfit) {
            this.logActivity(`Take Profit reached: $${this.sessionStats.totalProfit.toFixed(2)}`, 'success');
            return true;
        }

        if (Math.abs(this.sessionStats.totalProfit) >= this.profitSettings.stopLoss) {
            this.logActivity(`Stop Loss reached: $${this.sessionStats.totalProfit.toFixed(2)}`, 'error');
            return true;
        }

        return false;
    }

    releaseTradelock() {
        this.isTrading = false;
        this.activeContractId = null;
    }

    logActivity(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type,
            // Check if message contains negative profit
            isLoss: message.includes('Profit:') && message.includes('-$')
        };

        this.activityLog.unshift(logEntry);
        if (this.activityLog.length > this.maxLogEntries) {
            this.activityLog.pop();
        }

        this.updateActivityLog();
    }

    updateActivityLog() {
        const logContainer = document.getElementById('activity-log');
        if (!logContainer) return;

        const logContent = this.activityLog.map(entry => `
            <div class="log-entry ${entry.type} ${entry.isLoss ? 'loss' : ''}">
                <div class="log-content">
                    <span class="log-time">[${entry.timestamp}]</span>
                    <span class="log-message" ${entry.isLoss ? 'style="color: #ff4444;"' : ''}>${entry.message}</span>
                </div>
            </div>
        `).join('');

        const logWrapper = logContainer.querySelector('.log-content') || logContainer;
        logWrapper.innerHTML = logContent;
    }

    // Add validation for stake amount
    validateStake(stake) {
        const minStake = 0.35;
        const maxStake = 50000;

        if (stake < minStake) {
            this.logActivity(`Stake too low. Minimum stake is $${minStake}`, 'warning');
            return minStake;
        }
        if (stake > maxStake) {
            this.logActivity(`Stake too high. Maximum stake is $${maxStake}`, 'warning');
            return maxStake;
        }
        return parseFloat(stake.toFixed(2)); // Round to 2 decimal places
    }

    // Update stake setting
    setStake(amount) {
        this.initialStake = this.validateStake(parseFloat(amount));
        this.currentStake = this.initialStake;
        this.logActivity(`Initial stake set to $${this.initialStake}`, 'info');
    }

    // Clean up on destroy
    destroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
    }

    initializeMarketSubscriptions() {
        Object.keys(this.marketConfig).forEach(market => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    ticks: market,
                    subscribe: 1
                }));
                this.logActivity(`Subscribed to ${this.marketConfig[market].description}`, 'info');
            }
        });
    }

    // Update market selection method
    setMarket(market) {
        if (this.marketConfig[market]) {
            this.selectedMarket = market;
            const settings = this.marketSettings[market];
            this.timeframe = settings.timeframe;
            this.threshold = settings.threshold;
            this.updateMarketDisplay();
            this.logActivity(`Switched to ${this.marketConfig[market].description}`, 'info');
        }
    }

    // Add market-specific analysis
    analyzeMarket(market, ticks) {
        const settings = this.marketSettings[market];
        const timeframe = settings.timeframe;
        const threshold = settings.threshold;

        // Market-specific analysis logic
        const analysis = {
            volatility: this.calculateVolatility(ticks),
            trend: this.calculateTrend(ticks, timeframe),
            signal: this.calculateSignal(ticks, threshold)
        };

        return analysis;
    }

    updateMarketDisplay() {
        const marketInfo = document.getElementById('market-info');
        if (marketInfo && this.selectedMarket) {
            const config = this.marketConfig[this.selectedMarket];
            marketInfo.innerHTML = `
                <div class="market-details">
                    <h3>${config.description}</h3>
                    <div class="market-limits">
                        <span>Min Stake: $${config.minStake}</span>
                        <span>Max Stake: $${config.maxStake}</span>
                    </div>
                    <div class="profit-tracking">
                        <span>Current Profit: $${this.currentProfit.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    }

    async subscribeToContract(contractId) {
        return new Promise((resolve, reject) => {
            try {
                // Set timeout for contract subscription
                const subscriptionTimeout = setTimeout(() => {
                    this.releaseTradelock();
                    reject(new Error('Contract subscription timeout'));
                }, this.tradeLockTimeout);

                // Create message handler
                const messageHandler = async (msg) => {
                    const data = JSON.parse(msg.data);
                    if (data.proposal_open_contract && 
                        data.proposal_open_contract.contract_id === contractId) {
                        if (data.proposal_open_contract.is_sold) {
                            // Clean up
                            clearTimeout(subscriptionTimeout);
                            this.ws.removeEventListener('message', messageHandler);
                            
                            // Handle completion
                            await this.handleTradeCompletion(data.proposal_open_contract);
                            resolve(data.proposal_open_contract);
                        }
                    }
                };

                // Add message handler
                this.ws.addEventListener('message', messageHandler);

                // Send subscription request
                this.sendWSRequest({
                    proposal_open_contract: 1,
                    contract_id: contractId,
                    subscribe: 1
                }).catch(error => {
                    clearTimeout(subscriptionTimeout);
                    this.ws.removeEventListener('message', messageHandler);
                    reject(error);
                });

            } catch (error) {
                this.logActivity(`Failed to subscribe to contract: ${error.message}`, 'error');
                this.releaseTradelock();
                reject(error);
            }
        });
    }

    updateStatsDisplay() {
        ['trading-stats', 'trading-stats-bot'].forEach(containerId => {
            const statsContainer = document.getElementById(containerId);
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Total Profit/Loss:</span>
                            <span class="stat-value ${this.sessionStats.totalProfit >= 0 ? 'profit' : 'loss'}">
                                $${this.sessionStats.totalProfit.toFixed(2)}
                            </span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Highest Profit:</span>
                            <span class="stat-value profit">$${this.sessionStats.highestProfit.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Lowest Profit:</span>
                            <span class="stat-value loss">$${this.sessionStats.lowestProfit.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Take Profit:</span>
                            <span class="stat-value">$${this.profitSettings.takeProfit}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Stop Loss:</span>
                            <span class="stat-value">$${this.profitSettings.stopLoss}</span>
                        </div>
                    </div>
                `;
            }
        });
    }

    // Add this method to AetherBot class
    switchBotType(type) {
        if (type === 'random') {
            window.activeBot = window.randomBot;
            // Reset and initialize random bot
            window.randomBot.marketTradeCount = {
                'R_10': 0,
                'R_25': 0,
                'R_50': 0,
                'R_75': 0,
                'R_100': 0
            };
            window.randomBot.maxTradesPerMarket = window.randomBot.getRandomInt(3, 7);
            window.randomBot.updateOverlayInfo();
        } else {
            window.activeBot = window.aetherBot;
        }
        this.logActivity(`Switched to ${type} bot mode`, 'info');
    }

    updateButtonStates() {
        if (this.startButton && this.stopButton) {
            if (this.isRunning) {
                // Bot is running
                this.startButton.disabled = true;
                this.stopButton.disabled = false;
                this.startButton.classList.remove('blink');
                this.stopButton.classList.add('blink');
            } else {
                // Bot is stopped
                this.startButton.disabled = false;
                this.stopButton.disabled = true;
                this.startButton.classList.add('blink');
                this.stopButton.classList.remove('blink');
            }
        }
    }
}

// Initialize bot when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (!window.aetherBot && window.dashboardManager) {
        window.aetherBot = new AetherBot(window.dashboardManager.derivAPI);
    }
}); 