class OverdriveMode {
    constructor(bot) {
        this.bot = bot;
        this.isActive = false;
        this.scanInterval = 1000;
        this.scanTimer = null;
        this.isTrading = false;
        this.currentMarket = null;
        this.tradeLockTimeout = 60000;
        this.minTimeBetweenTrades = 2000;
        this.lastTradeTime = 0;
        this.markets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
        this.currentMarketIndex = 0;
        this.tradesPerMarket = this.getRandomTradeCount();
        this.currentTradeCount = 0;
        this.consecutiveLosses = 0;
        this.maxLossesBeforeSwitch = 3; // Switch market after 3 consecutive losses
    }

    getRandomTradeCount() {
        // Random number between 3 and 7 trades per market
        return Math.floor(Math.random() * 5) + 3;
    }

    async start() {
        console.log('Overdrive start called');
        this.isActive = true;
        this.currentMarketIndex = Math.floor(Math.random() * this.markets.length);
        this.tradesPerMarket = this.getRandomTradeCount();
        this.currentTradeCount = 0;
        this.logActivity(`🚀 OVERDRIVE MODE ACTIVATED - Starting with ${this.markets[this.currentMarketIndex]}`, 'success');
        await this.tradeCycle();
    }

    switchMarket() {
        this.currentMarketIndex = (this.currentMarketIndex + 1) % this.markets.length;
        this.currentTradeCount = 0;
        this.consecutiveLosses = 0;
        this.tradesPerMarket = this.getRandomTradeCount();
        this.logActivity(`Switching to ${this.markets[this.currentMarketIndex]} - Planning ${this.tradesPerMarket} trades`, 'info');
    }

    async tradeCycle() {
        while (this.isActive && !this.isTrading) {
            try {
                const currentMarket = this.markets[this.currentMarketIndex];
                const analysis = await this.bot.getMarketAnalysis(currentMarket);

                this.logActivity(`Market: ${currentMarket} | Signal: ${analysis?.signalStrength}% | Trade ${this.currentTradeCount + 1}/${this.tradesPerMarket}`, 'info');

                if (analysis && parseFloat(analysis.signalStrength) > 75) {
                    await this.placeTrade(currentMarket, analysis.trend === 'Bullish' ? 'CALL' : 'PUT');
                    this.currentTradeCount++;
                }

                // Switch market conditions
                if (this.consecutiveLosses >= this.maxLossesBeforeSwitch || 
                    this.currentTradeCount >= this.tradesPerMarket) {
                    this.switchMarket();
                }

                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                this.logActivity(`Error: ${error.message}`, 'error');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    // Update handleTradeCompletion to track consecutive losses
    async handleTradeCompletion(contract) {
        const profit = parseFloat(contract.profit);
        if (profit >= 0) {
            this.consecutiveLosses = 0;
            this.logActivity(`Win on ${this.currentMarket}! Profit: $${profit.toFixed(2)}`, 'success');
        } else {
            this.consecutiveLosses++;
            this.logActivity(`Loss on ${this.currentMarket}. Consecutive losses: ${this.consecutiveLosses}`, 'error');
            
            if (this.consecutiveLosses >= this.maxLossesBeforeSwitch) {
                this.logActivity(`Max losses reached on ${this.currentMarket}, switching markets`, 'warning');
                this.switchMarket();
            }
        }
    }

    // Rest of your existing methods (stop, placeTrade, waitForTradeCompletion, logActivity)
    // ... keep them as they are
}

// Add to window object for global access
window.OverdriveMode = OverdriveMode; 