class RandomBot extends AetherBot {
    constructor(derivAPI) {
        super(derivAPI);
        
        // Random bot specific settings
        this.marketTradeCount = {
            'R_10': 0,
            'R_25': 0,
            'R_50': 0,
            'R_75': 0,
            'R_100': 0
        };
        this.maxTradesPerMarket = this.getRandomInt(3, 7);
        this.lastMarketSwitch = Date.now();
        this.marketTimeout = 300000; // 5 minutes
        
        // Add market-specific statistics
        this.marketStats = {
            'R_10': { wins: 0, losses: 0, consecutiveLosses: 0 },
            'R_25': { wins: 0, losses: 0, consecutiveLosses: 0 },
            'R_50': { wins: 0, losses: 0, consecutiveLosses: 0 },
            'R_75': { wins: 0, losses: 0, consecutiveLosses: 0 },
            'R_100': { wins: 0, losses: 0, consecutiveLosses: 0 }
        };
        
        // Add performance thresholds
        this.switchThresholds = {
            consecutiveLosses: 3,  // Switch after 3 consecutive losses
            winRate: 0.4  // Switch if win rate falls below 40%
        };
        
        // Initialize overlay on construction
        this.initializeOverlay();
        
        // Add this debug log
        console.log('RandomBot initialized with:', {
            market: this.selectedMarket,
            tradeCount: this.marketTradeCount,
            maxTrades: this.maxTradesPerMarket
        });
    }

    initializeOverlay() {
        console.log('Initializing overlay...');
        this.updateOverlayInfo();
        this.startMarketTimer();
    }

    async placeTrade(direction) {
        if (this.isTrading) return;

        try {
            console.log(`Current market: ${this.selectedMarket}`);
            console.log(`Trade count before: ${this.marketTradeCount[this.selectedMarket]}`);

            const tickDuration = this.getDynamicTicks();
            const contract = await this.sendWSRequest({
                buy: 1,
                price: this.currentStake,
                parameters: {
                    contract_type: direction,
                    symbol: this.selectedMarket,
                    duration: tickDuration,
                    duration_unit: 't',
                    basis: 'stake',
                    amount: this.currentStake,
                    currency: 'USD'
                }
            });

            if (contract.error) {
                throw new Error(contract.error.message);
            }

            // Increment trade count
            this.marketTradeCount[this.selectedMarket]++;
            console.log(`Trade count after increment: ${this.marketTradeCount[this.selectedMarket]}`);

            // Force overlay update
            this.updateOverlayInfo();

            this.activeContractId = contract.buy.contract_id;
            this.logActivity(`Trade ${this.marketTradeCount[this.selectedMarket]}/${this.maxTradesPerMarket} on ${this.selectedMarket}`, 'success');

            await this.waitForTradeCompletion(this.activeContractId);

            // Check if we need to switch markets
            if (this.marketTradeCount[this.selectedMarket] >= this.maxTradesPerMarket) {
                await this.switchMarket();
            }

        } catch (error) {
            this.logActivity(`Trade error: ${error.message}`, 'error');
        } finally {
            this.releaseTradelock();
        }
    }

    updateOverlayInfo() {
        console.log('Updating overlay info...');
        const overlay = document.getElementById('random-market-overlay');
        const currentMarket = document.getElementById('random-current-market');
        const tradeCount = document.getElementById('random-trade-count');
        const tradeLimit = document.getElementById('random-trade-limit');

        if (overlay && currentMarket && tradeCount && tradeLimit) {
            const count = this.marketTradeCount[this.selectedMarket] || 0;
            currentMarket.textContent = this.marketConfig[this.selectedMarket].description;
            tradeCount.textContent = count.toString();
            tradeLimit.textContent = this.maxTradesPerMarket.toString();

            console.log('Updated overlay with:', {
                market: this.selectedMarket,
                count: count,
                limit: this.maxTradesPerMarket
            });
        } else {
            console.error('Overlay elements not found:', {
                overlay: !!overlay,
                currentMarket: !!currentMarket,
                tradeCount: !!tradeCount,
                tradeLimit: !!tradeLimit
            });
        }

        // Add statistics to overlay
        const stats = this.marketStats[this.selectedMarket];
        const totalTrades = stats.wins + stats.losses;
        const winRate = totalTrades > 0 ? ((stats.wins / totalTrades) * 100).toFixed(1) : '0.0';

        const statsElement = document.createElement('div');
        statsElement.className = 'market-stats';
        statsElement.innerHTML = `
            <div class="stat-item">Win Rate: ${winRate}%</div>
            <div class="stat-item">Wins: ${stats.wins}</div>
            <div class="stat-item">Losses: ${stats.losses}</div>
            <div class="stat-item">Consecutive Losses: ${stats.consecutiveLosses}</div>
        `;

        const existingStats = overlay.querySelector('.market-stats');
        if (existingStats) {
            existingStats.replaceWith(statsElement);
        } else {
            overlay.querySelector('.overlay-content').appendChild(statsElement);
        }
    }

    async switchMarket() {
        const newMarket = this.getRandomMarket();
        if (newMarket) {
            this.selectedMarket = newMarket;
            this.lastMarketSwitch = Date.now();
            this.maxTradesPerMarket = this.getRandomInt(3, 7);
            
            // Reset trade count for new market
            this.marketTradeCount[this.selectedMarket] = 0;
            
            // Reset statistics for the new market
            this.marketStats[newMarket] = {
                wins: 0,
                losses: 0,
                consecutiveLosses: 0
            };
            
            this.logActivity(`Switched to ${this.marketConfig[newMarket].description}`, 'info');
            await this.getMarketAnalysis();
            this.updateMarketDisplay();
            this.updateOverlayInfo();
        }
    }

    startMarketTimer() {
        setInterval(() => {
            if (this.isRunning) {
                const timeLeft = this.marketTimeout - (Date.now() - this.lastMarketSwitch);
                if (timeLeft > 0) {
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    document.getElementById('random-market-timer').textContent = 
                        `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    getRandomMarket() {
        const availableMarkets = this.availableMarkets.filter(
            market => this.marketTradeCount[market] < this.maxTradesPerMarket
        );
        return availableMarkets[Math.floor(Math.random() * availableMarkets.length)];
    }

    getDynamicTicks() {
        return this.getRandomInt(3, 9);
    }

    async waitForTradeCompletion(contractId) {
        await super.waitForTradeCompletion(contractId);
        // Update overlay after trade completion
        this.updateOverlayInfo();
    }

    async handleTradeCompletion(contract) {
        const profit = parseFloat(contract.profit);
        const market = this.selectedMarket;
        
        // Update market statistics
        if (profit > 0) {
            this.marketStats[market].wins++;
            this.marketStats[market].consecutiveLosses = 0;
        } else {
            this.marketStats[market].losses++;
            this.marketStats[market].consecutiveLosses++;
        }

        // Check if we need to switch markets based on performance
        if (this.shouldSwitchMarket()) {
            this.logActivity(`Switching market due to poor performance`, 'warning');
            await this.switchMarket();
        }

        // Update overlay with new stats
        this.updateOverlayInfo();
    }

    shouldSwitchMarket() {
        const stats = this.marketStats[this.selectedMarket];
        const totalTrades = stats.wins + stats.losses;
        const winRate = totalTrades > 0 ? stats.wins / totalTrades : 0;

        return (
            stats.consecutiveLosses >= this.switchThresholds.consecutiveLosses ||
            (totalTrades >= 5 && winRate < this.switchThresholds.winRate)
        );
    }
}

// Initialize bot when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize RandomBot
    if (!window.randomBot && window.dashboardManager) {
        window.randomBot = new RandomBot(window.dashboardManager.derivAPI);
    }

    // Add event listener for bot type changes
    const botTypeSelect = document.getElementById('bot-type');
    if (botTypeSelect) {
        botTypeSelect.addEventListener('change', (e) => {
            const isRandom = e.target.value === 'random';
            const overlay = document.getElementById('random-market-overlay');
            if (overlay) {
                overlay.style.display = isRandom ? 'flex' : 'none';
            }
            
            if (isRandom && window.randomBot) {
                window.randomBot.updateOverlayInfo();
            }
        });
    }
});
