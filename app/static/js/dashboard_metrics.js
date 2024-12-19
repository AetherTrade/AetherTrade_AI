class DashboardMetrics {
    constructor() {
        this.initialRiskPercentage = 0.007;
        this.tickBuffer = [];
        this.bufferSize = 100; // Store last 100 ticks for analysis
        this.initializeMetrics();
        this.startBalanceMonitoring();
        this.startMarketAnalysis();
    }

    initializeMetrics() {
        this.marketMetrics = {
            trend: document.getElementById('market-trend'),
            volatility: document.getElementById('market-volatility'),
            signalStrength: document.getElementById('signal-strength'),
            marketPhase: document.getElementById('market-phase')
        };
        this.riskMetrics = {
            riskPerTrade: document.getElementById('risk-per-trade'),
            safetyLevel: document.getElementById('safety-level')
        };
    }

    addTick(tick) {
        this.tickBuffer.push(tick);
        if (this.tickBuffer.length > this.bufferSize) {
            this.tickBuffer.shift(); // Remove oldest tick
        }
        this.analyzeMarket();
    }

    analyzeMarket() {
        if (this.tickBuffer.length < 20) return; // Need minimum data

        const prices = this.tickBuffer.map(t => t.quote);
        
        // Calculate trend
        const shortMA = this.calculateSMA(prices, 10);
        const longMA = this.calculateSMA(prices, 20);
        const trend = this.determineTrend(shortMA, longMA);
        
        // Calculate volatility
        const volatility = this.calculateVolatility(prices);
        
        // Calculate signal strength
        const signalStrength = this.calculateSignalStrength(trend, volatility);
        
        // Determine market phase
        const phase = this.determineMarketPhase(prices);

        // Update displays
        this.updateMarketMetrics({
            trend,
            volatility,
            signalStrength,
            phase
        });
    }

    calculateSMA(prices, period) {
        const slice = prices.slice(-period);
        return slice.reduce((sum, price) => sum + price, 0) / period;
    }

    determineTrend(shortMA, longMA) {
        const difference = ((shortMA - longMA) / longMA) * 100;
        
        if (difference > 0.1) return { direction: 'Uptrend', strength: difference };
        if (difference < -0.1) return { direction: 'Downtrend', strength: Math.abs(difference) };
        return { direction: 'Neutral', strength: 0 };
    }

    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    calculateSignalStrength(trend, volatility) {
        const baseStrength = trend.strength;
        const volatilityFactor = 1 - Math.min(volatility * 10, 0.5);
        return Math.min(baseStrength * volatilityFactor * 100, 100);
    }

    determineMarketPhase(prices) {
        const recentPrices = prices.slice(-20);
        const highs = Math.max(...recentPrices);
        const lows = Math.min(...recentPrices);
        const range = highs - lows;
        const currentPrice = prices[prices.length - 1];
        
        if (range / currentPrice < 0.001) return 'Ranging';
        if (currentPrice > highs - (range * 0.1)) return 'Overbought';
        if (currentPrice < lows + (range * 0.1)) return 'Oversold';
        return 'Trending';
    }

    updateMarketMetrics(analysis) {
        if (this.marketMetrics.trend) {
            this.marketMetrics.trend.textContent = analysis.trend.direction;
            this.marketMetrics.trend.className = `metric-value ${analysis.trend.direction.toLowerCase()}`;
        }

        if (this.marketMetrics.volatility) {
            const volatilityLevel = this.getVolatilityLevel(analysis.volatility);
            this.marketMetrics.volatility.textContent = volatilityLevel;
            this.marketMetrics.volatility.className = `metric-value ${volatilityLevel.toLowerCase()}`;
        }

        if (this.marketMetrics.signalStrength) {
            this.marketMetrics.signalStrength.textContent = `${analysis.signalStrength.toFixed(1)}%`;
            this.marketMetrics.signalStrength.className = `metric-value ${this.getSignalClass(analysis.signalStrength)}`;
        }

        if (this.marketMetrics.marketPhase) {
            this.marketMetrics.marketPhase.textContent = analysis.phase;
            this.marketMetrics.marketPhase.className = `metric-value ${analysis.phase.toLowerCase()}`;
        }
    }

    getVolatilityLevel(volatility) {
        if (volatility > 0.002) return 'High';
        if (volatility > 0.001) return 'Medium';
        return 'Low';
    }

    getSignalClass(strength) {
        if (strength > 70) return 'strong';
        if (strength > 30) return 'moderate';
        return 'weak';
    }
}

// Connect to tick collector
document.addEventListener('DOMContentLoaded', () => {
    const metrics = new DashboardMetrics();
    
    // Listen for ticks from tick collector
    window.addEventListener('tick', (event) => {
        metrics.addTick(event.detail);
    });
}); 