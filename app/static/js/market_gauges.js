class MarketGauges {
    constructor() {
        this.gauges = new Map();
        this.priceHistory = new Map();
        this.markets = ['R_50', 'R_75', 'R_100'];
        this.maxSpeed = {
            'R_50': 0.001,
            'R_75': 0.0015,
            'R_100': 0.002
        };
        this.lastPrices = new Map();
        this.rollingChanges = new Map();
        
        // Initialize histories and rolling changes
        this.markets.forEach(market => {
            this.priceHistory.set(market, []);
            this.lastPrices.set(market, null);
            this.rollingChanges.set(market, []);
        });
        
        // Load gauge.js before initializing
        this.loadGaugeScript().then(() => {
            this.initGauges();
            console.log('Gauges initialized');
        });
    }

    // Add script loader
    loadGaugeScript() {
        return new Promise((resolve, reject) => {
            if (window.Gauge) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://bernii.github.io/gauge.js/dist/gauge.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load gauge.js'));
            document.head.appendChild(script);
        });
    }

    initGauges() {
        this.markets.forEach(market => {
            const canvas = document.getElementById(`gauge-${market}`);
            console.log(`Initializing gauge for ${market}`, canvas);
            
            if (!canvas) {
                console.error(`Canvas not found for ${market}`);
                return;
            }

            try {
                const gauge = new Gauge(canvas).setOptions({
                    angle: -0.2,
                    lineWidth: 0.2,
                    radiusScale: 0.85,
                    pointer: {
                        length: 0.6,
                        strokeWidth: 0.035,
                        color: '#fff',
                        shadowColor: 'rgba(var(--primary-rgb), 0.5)',
                        shadowBlur: 10
                    },
                    limitMax: true,
                    limitMin: true,
                    generateGradient: true,
                    highDpiSupport: true,
                    staticLabels: {
                        font: "12px 'Share Tech Mono'",
                        labels: [0, 25, 50, 75, 100],
                        color: "rgba(255, 255, 255, 0.8)",
                        fractionDigits: 0
                    },
                    staticZones: [
                        {strokeStyle: "rgba(48, 179, 45, 0.9)", min: 0, max: 30},
                        {strokeStyle: "rgba(255, 221, 0, 0.9)", min: 30, max: 60},
                        {strokeStyle: "rgba(240, 62, 62, 0.9)", min: 60, max: 100}
                    ],
                    renderTicks: {
                        divisions: 10,
                        divWidth: 1.1,
                        divLength: 0.5,
                        divColor: 'rgba(255, 255, 255, 0.2)',
                        subDivisions: 5,
                        subLength: 0.25,
                        subWidth: 0.6,
                        subColor: 'rgba(255, 255, 255, 0.1)'
                    }
                });

                // Set initial values
                gauge.maxValue = 100;
                gauge.setMinValue(0);
                gauge.set(0);
                
                // Store gauge instance
                this.gauges.set(market, gauge);
                
                console.log(`Gauge initialized for ${market}`);
            } catch (error) {
                console.error(`Error initializing gauge for ${market}:`, error);
            }
        });
    }

    updateGauge(market, price) {
        const gauge = this.gauges.get(market);
        const valueDisplay = document.getElementById(`gauge-value-${market}`);
        if (!gauge || !valueDisplay) return;

        const now = Date.now();
        const lastPrice = this.lastPrices.get(market);
        const rollingChanges = this.rollingChanges.get(market);

        if (lastPrice !== null) {
            // Calculate immediate change
            const immediateChange = Math.abs((price - lastPrice) / lastPrice);
            
            // Add to rolling changes
            rollingChanges.push(immediateChange);
            
            // Keep last 10 changes for rolling average
            if (rollingChanges.length > 10) {
                rollingChanges.shift();
            }

            // Calculate rolling average speed
            const avgChange = rollingChanges.reduce((a, b) => a + b, 0) / rollingChanges.length;
            const amplifiedSpeed = avgChange * 1000; // Amplify the changes
            
            // Calculate percentage for gauge
            const speedPercentage = (amplifiedSpeed / this.maxSpeed[market]) * 100;
            const clampedPercentage = Math.min(Math.max(speedPercentage, 0), 100);

            // Update gauge
            gauge.set(clampedPercentage);

            // Format display value
            const displaySpeed = (amplifiedSpeed * 100).toFixed(3);
            valueDisplay.textContent = `${displaySpeed}%/s`;
            valueDisplay.className = `gauge-value ${this.getSpeedClass(clampedPercentage)}`;

            // Debug with meaningful values
            console.log(`${market} - Speed: ${displaySpeed}%/s, Gauge: ${clampedPercentage.toFixed(1)}%`);
        }

        // Store current price
        this.lastPrices.set(market, price);

        // Update price history
        const history = this.priceHistory.get(market);
        history.push({ price, time: now });
        
        // Keep last second of history
        while (history.length > 0 && now - history[0].time > 1000) {
            history.shift();
        }
    }

    updateFromTick(tick) {
        if (!tick || !tick.symbol || tick.quote === undefined) {
            console.error('Invalid tick data:', tick);
            return;
        }

        const market = tick.symbol;
        const price = parseFloat(tick.quote);

        if (isNaN(price)) {
            console.error('Invalid price in tick:', tick);
            return;
        }

        this.updateGauge(market, price);
    }

    getSpeedClass(speedPercentage) {
        if (speedPercentage < 30) return 'low-speed';
        if (speedPercentage < 60) return 'medium-speed';
        return 'high-speed';
    }
}

// Initialize gauges when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.marketGauges = new MarketGauges();
}); 