class TickCollector {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.tickData = new Map(); // Market -> Array of ticks
        this.maxStorageTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.markets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']; // Updated markets list
        this.storageKey = 'aether_tick_data';
        
        this.lastSyncTime = parseInt(localStorage.getItem('lastSyncTime')) || 0;
        this.pageLoadTime = Date.now();
        
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
        
        this.syncStatus = {
            lastSync: null,
            ticksReceived: 0,
            isConnected: false
        };
        
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isInitialized = false;
        
        this.maxTicksPerMarket = 5000; // Reduce from 100000 to 5000
        this.totalTicksProcessed = 0; // Keep track of total ticks ever processed
        
        this.init();
        this.loadStoredData();
        
        // Periodically clean old data and save to localStorage
        setInterval(() => this.cleanOldData(), 60000); // Every minute
        setInterval(() => this.saveToStorage(), 300000); // Every 5 minutes
        
        // Update UI every second
        setInterval(() => this.updateUI(), 1000);
        
        // Initialize WebWorker if supported
        this.initializeWorker();
        
        // Attempt initial sync with retry
        this.attemptInitialSync();

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('Page visible, syncing data...');
                this.syncWithServer();
            }
        });

        // Add retention info to UI
        this.updateRetentionInfo();
    }

    async init() {
        console.log('Initializing TickCollector...');
        try {
            if (!this.isInitialized) {
                this.initializeWebSocket();
                this.isInitialized = true;
            }
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    initializeWebSocket() {
        if (this.ws) {
            console.log('Closing existing WebSocket connection...');
            this.ws.close();
        }

        console.log('Creating new WebSocket connection...');
        try {
            this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

            this.ws.onopen = () => {
                console.log('WebSocket connection established successfully');
                this.reconnectAttempts = 0;
                this.syncStatus.isConnected = true;
                this.subscribeToMarkets();
                this.updateUI();
            };

            this.ws.onmessage = (msg) => {
                try {
                    const data = JSON.parse(msg.data);
                    if (data.tick) {
                        this.processTick(data.tick);
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error occurred:', error);
                this.syncStatus.isConnected = false;
                this.updateUI();
            };

            this.ws.onclose = (event) => {
                console.log(`WebSocket closed with code ${event.code}. Reason: ${event.reason}`);
                this.syncStatus.isConnected = false;
                this.updateUI();
                this.handleReconnect();
            };

        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.syncStatus.isConnected = false;
            this.updateUI();
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff
            console.log(`Attempting to reconnect in ${delay/1000} seconds... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                console.log('Executing reconnection attempt...');
                this.initializeWebSocket();
            }, delay);
        } else {
            console.error('Maximum reconnection attempts reached. Please refresh the page.');
            // Add UI notification for user
            this.showConnectionError();
        }
    }

    subscribeToMarkets() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('Cannot subscribe: WebSocket is not open');
            return;
        }

        console.log('Subscribing to markets:', this.markets);
        this.markets.forEach(market => {
            try {
                const subscription = JSON.stringify({
                    ticks: market,
                    subscribe: 1
                });
                console.log(`Subscribing to ${market}...`);
                this.ws.send(subscription);
            } catch (error) {
                console.error(`Error subscribing to ${market}:`, error);
            }
        });
    }

    processTick(tick) {
        if (!this.tickData.has(tick.symbol)) {
            this.tickData.set(tick.symbol, []);
        }

        const marketTicks = this.tickData.get(tick.symbol);
        marketTicks.push({
            price: tick.quote,
            timestamp: tick.epoch * 1000
        });

        // Keep only last maxTicksPerMarket ticks
        if (marketTicks.length > this.maxTicksPerMarket) {
            marketTicks.shift(); // Remove oldest tick
        }

        this.totalTicksProcessed++;
        this.updateUI();
    }

    cleanOldData() {
        const now = Date.now();
        this.tickData.forEach((ticks, market) => {
            const filteredTicks = ticks.filter(tick => 
                now - tick.timestamp <= this.maxStorageTime
            );
            this.tickData.set(market, filteredTicks);
        });
    }

    saveToStorage() {
        try {
            // Only store last 1000 ticks per market to save space
            const storageData = {};
            this.tickData.forEach((ticks, market) => {
                storageData[market] = ticks.slice(-1000);
            });

            // Compress data before storing
            const compressedData = this.compressData(storageData);
            
            try {
                localStorage.setItem(this.storageKey, compressedData);
                console.log('Tick data saved successfully');
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    // If storage is full, clear old data and try again
                    this.clearOldData();
                    localStorage.setItem(this.storageKey, compressedData);
                    console.log('Storage cleared and data saved successfully');
                } else {
                    throw e;
                }
            }
        } catch (error) {
            console.error('Error saving tick data:', error);
            // Fallback: Try to save only the most recent data
            this.saveMinimalData();
        }
    }

    saveMinimalData() {
        try {
            // Save only the last 100 ticks per market
            const minimalData = {};
            this.tickData.forEach((ticks, market) => {
                minimalData[market] = ticks.slice(-100);
            });

            const compressedData = this.compressData(minimalData);
            localStorage.setItem(this.storageKey, compressedData);
            console.log('Minimal tick data saved successfully');
        } catch (error) {
            console.error('Failed to save even minimal data:', error);
        }
    }

    compressData(data) {
        // Optimize data structure for storage
        const optimizedData = {};
        for (const [market, ticks] of Object.entries(data)) {
            optimizedData[market] = ticks.map(tick => [
                tick.timestamp,
                parseFloat(tick.price.toFixed(6)) // Reduce precision to save space
            ]);
        }
        return JSON.stringify(optimizedData);
    }

    loadStoredData() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // Convert compressed data back to full format
                Object.entries(parsedData).forEach(([market, ticks]) => {
                    const expandedTicks = ticks.map(([timestamp, price]) => ({
                        market,
                        timestamp,
                        price
                    }));
                    this.tickData.set(market, expandedTicks);
                });
                
                console.log('Stored tick data loaded successfully');
            }
        } catch (error) {
            console.error('Error loading stored tick data:', error);
            // Clear potentially corrupted data
            localStorage.removeItem(this.storageKey);
        }
    }

    clearOldData() {
        // Keep only recent data
        this.tickData.forEach((ticks, market) => {
            const now = Date.now();
            const recentTicks = ticks.filter(tick => 
                (now - tick.timestamp) < (24 * 60 * 60 * 1000) // Keep last 24 hours
            );
            this.tickData.set(market, recentTicks);
        });

        // Clear other potentially large items from localStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key !== this.storageKey && key.includes('tick')) {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error('Error clearing old data:', error);
        }
    }

    // Helper methods for analysis
    getTicksForPeriod(market, startTime, endTime) {
        const ticks = this.tickData.get(market) || [];
        return ticks.filter(tick => 
            tick.timestamp >= startTime && tick.timestamp <= endTime
        );
    }

    calculateMACD(market, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
        const ticks = this.tickData.get(market) || [];
        if (ticks.length < longPeriod) return null;

        // Implementation of MACD calculation
        // ... (MACD calculation logic)
    }

    updateUI() {
        // Update connection status with more detail
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            let status = 'Disconnected';
            let className = 'value disconnected';
            
            if (this.ws) {
                switch (this.ws.readyState) {
                    case WebSocket.CONNECTING:
                        status = 'Connecting...';
                        className = 'value warning';
                        break;
                    case WebSocket.OPEN:
                        status = `Connected (${this.tickData.size} markets)`;
                        className = 'value connected';
                        break;
                    case WebSocket.CLOSING:
                        status = 'Closing...';
                        className = 'value warning';
                        break;
                    case WebSocket.CLOSED:
                        status = `Disconnected (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
                        className = 'value disconnected';
                        break;
                }
            }
            
            connectionStatus.textContent = status;
            connectionStatus.className = className;
        }

        // Update total ticks with formatted number
        const totalTicks = document.getElementById('total-ticks');
        if (totalTicks) {
            const ticksPerSecond = this.calculateTickRate();
            totalTicks.textContent = `${this.formatLargeNumber(this.totalTicksProcessed)} (${ticksPerSecond}/s)`;
        }

        // Update sync status
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            if (this.syncStatus.lastSync) {
                const timeSinceSync = Date.now() - this.syncStatus.lastSync;
                syncStatus.textContent = `Last sync: ${this.formatTimeAgo(this.syncStatus.lastSync)}`;
                syncStatus.className = `value ${timeSinceSync < 60000 ? 'connected' : 'warning'}`;
            } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                syncStatus.textContent = 'Live data streaming';
                syncStatus.className = 'value connected';
            }
        }

        // Update storage status
        this.updateStorageStatus();
        
        // Update market data
        this.updateMarketData();
    }

    calculateTickRate() {
        const now = Date.now();
        const recentTicks = Array.from(this.tickData.values())
            .flat()
            .filter(tick => now - tick.timestamp < 1000)
            .length;
        return recentTicks;
    }

    getOldestDataAge() {
        let oldest = Date.now();
        this.tickData.forEach(ticks => {
            if (ticks.length > 0) {
                oldest = Math.min(oldest, ticks[0].timestamp);
            }
        });
        return oldest !== Date.now() ? oldest : null;
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'Never';
        
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 0) return 'Just now'; // Handle future timestamps
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days > 3) return 'Never'; // Since we only keep 3 days of data
        return `${days}d ago`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    calculateStorageSize() {
        const data = JSON.stringify(Array.from(this.tickData.entries()));
        return new Blob([data]).size;
    }

    initializeWorker() {
        if (window.Worker) {
            try {
                this.worker = new Worker('/static/js/tick_worker.js');
                this.worker.onmessage = (e) => {
                    if (e.data.type === 'TICK_UPDATE') {
                        this.processTick(e.data.tick);
                    }
                };
            } catch (error) {
                console.error('Failed to initialize WebWorker:', error);
            }
        }
    }

    async attemptInitialSync() {
        console.log('Attempting initial sync...');
        try {
            const response = await fetch('/api/ticks/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    markets: this.markets,
                    lastSync: 0 // Get all available data on initial sync
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Received ${data.ticks?.length || 0} ticks from initial sync`);
            
            if (data.success && data.ticks && data.ticks.length > 0) {
                this.mergeTicks(data.ticks);
                this.syncStatus.lastSync = Date.now();
                this.syncStatus.ticksReceived += data.ticks.length;
                console.log('Initial sync successful');
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Initial sync failed:', error);
            // Don't throw error, just log it and continue
            this.showSyncError(error.message);
        }
    }

    startPeriodicSync() {
        console.log('Starting periodic sync...');
        // Sync every 30 seconds
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.syncWithServer();
            }
        }, 30000);
    }

    async syncWithServer() {
        console.log('Syncing with server...');
        try {
            const response = await fetch('/api/ticks/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    markets: this.markets,
                    lastSync: this.lastSyncTime
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success && data.ticks) {
                this.mergeTicks(data.ticks);
                this.lastSyncTime = Date.now();
                localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());
                console.log(`Synced ${data.ticks.length} new ticks`);
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Sync failed:', error);
            this.showSyncError(error.message);
        }
    }

    updateRetentionInfo() {
        const retentionInfo = document.getElementById('data-retention');
        if (retentionInfo) {
            retentionInfo.textContent = `${this.maxStorageTime / (24 * 60 * 60 * 1000)} days`;
        }
    }

    calculateStorageMetrics() {
        let oldestTimestamp = Date.now();
        let totalTicks = 0;

        this.tickData.forEach((ticks) => {
            totalTicks += ticks.length;
            if (ticks.length > 0) {
                oldestTimestamp = Math.min(oldestTimestamp, ticks[0].timestamp);
            }
        });

        return {
            oldestTimestamp,
            totalTicks,
            storageSize: this.calculateStorageSize()
        };
    }

    showConnectionError() {
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            connectionStatus.textContent = 'Connection Failed - Please Refresh';
            connectionStatus.className = 'value error';
        }
    }

    updateStorageStatus() {
        const dataAge = document.getElementById('data-age');
        const storageUsed = document.getElementById('storage-used');
        
        if (dataAge && storageUsed) {
            let oldestTimestamp = Date.now();
            let totalSize = 0;
            
            this.tickData.forEach((ticks, market) => {
                if (ticks.length > 0) {
                    oldestTimestamp = Math.min(oldestTimestamp, ticks[0].timestamp);
                }
                totalSize += JSON.stringify(ticks).length;
            });

            if (oldestTimestamp !== Date.now()) {
                dataAge.textContent = this.formatTimeAgo(oldestTimestamp);
            } else {
                dataAge.textContent = 'No data';
            }

            storageUsed.textContent = this.formatBytes(totalSize);
        }
    }

    updateMarketData() {
        const container = document.getElementById('market-data-container');
        if (container) {
            container.innerHTML = ''; // Clear existing content
            
            this.tickData.forEach((ticks, market) => {
                const lastTick = ticks[ticks.length - 1];
                if (!lastTick) return;

                const marketCard = document.createElement('div');
                marketCard.className = 'market-data-item';
                
                const priceChange = this.calculatePriceChange(ticks);
                const changeClass = priceChange >= 0 ? 'positive' : 'negative';
                
                marketCard.innerHTML = `
                    <div class="market-name">${market}</div>
                    <div class="price ${changeClass}">${lastTick.price.toFixed(4)}</div>
                    <div class="change ${changeClass}">
                        ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(4)}
                    </div>
                    <div class="tick-count">${ticks.length} ticks</div>
                `;
                
                container.appendChild(marketCard);
            });
        }
    }

    calculatePriceChange(ticks) {
        if (ticks.length < 2) return 0;
        const lastPrice = ticks[ticks.length - 1].price;
        const firstPrice = ticks[Math.max(0, ticks.length - 100)].price; // Last 100 ticks
        return lastPrice - firstPrice;
    }

    formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    showSyncError(message) {
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            syncStatus.textContent = `Sync Error: ${message}`;
            syncStatus.className = 'value error';
        }
    }

    mergeTicks(newTicks) {
        if (!Array.isArray(newTicks)) {
            console.error('Invalid ticks data:', newTicks);
            return;
        }

        newTicks.forEach(tick => {
            if (!tick.market || !tick.price || !tick.timestamp) {
                console.warn('Invalid tick data:', tick);
                return;
            }

            // Initialize array for market if it doesn't exist
            if (!this.tickData.has(tick.market)) {
                this.tickData.set(tick.market, []);
            }

            const marketTicks = this.tickData.get(tick.market);

            // Add new tick while maintaining chronological order
            const insertIndex = marketTicks.findIndex(t => t.timestamp > tick.timestamp);
            if (insertIndex === -1) {
                // Add to end if timestamp is newest
                marketTicks.push({
                    price: parseFloat(tick.price),
                    timestamp: parseInt(tick.timestamp),
                    market: tick.market
                });
            } else if (marketTicks[insertIndex].timestamp !== tick.timestamp) {
                // Insert at correct position if timestamp doesn't already exist
                marketTicks.splice(insertIndex, 0, {
                    price: parseFloat(tick.price),
                    timestamp: parseInt(tick.timestamp),
                    market: tick.market
                });
            }

            // Trim old ticks if we exceed maximum
            if (marketTicks.length > this.maxTicksPerMarket) {
                marketTicks.splice(0, marketTicks.length - this.maxTicksPerMarket);
            }

            this.totalTicksProcessed++;
        });

        // Update UI after merging ticks
        this.updateUI();
        this.updateMarketData();

        // Save to storage if we have significant changes
        if (newTicks.length > 100) {
            this.saveToStorage();
        }

        console.log(`Merged ${newTicks.length} ticks successfully`);
    }
}

// Initialize the collector when the document loads
document.addEventListener('DOMContentLoaded', () => {
    if (!window.tickCollector) {
        window.tickCollector = new TickCollector();
    }
}); 