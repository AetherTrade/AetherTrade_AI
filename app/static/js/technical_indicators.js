class TechnicalIndicators {
    static calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];
        
        return data.map((price, i) => {
            if (i === 0) return ema;
            ema = price * k + ema * (1 - k);
            return ema;
        });
    }

    static calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
        const shortEMA = this.calculateEMA(data, shortPeriod);
        const longEMA = this.calculateEMA(data, longPeriod);
        const macdLine = shortEMA.map((short, i) => short - longEMA[i]);
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

        return {
            macdLine,
            signalLine,
            histogram
        };
    }

    // Add more indicators as needed
} 