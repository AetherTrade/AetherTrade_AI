import numpy as np
import pandas as pd
import ta
from app.models.tick_data import TickData
from datetime import datetime, timedelta

class HybridTradingStrategy:
    def __init__(self, short_ema=3, long_ema=6, bb_period=14, bb_std=2, rsi_period=7):
        self.short_ema = short_ema
        self.long_ema = long_ema
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.rsi_period = rsi_period
        self.SIGNAL_THRESHOLD = 75
        self.TICK_WINDOW = 100  # Number of ticks to analyze
        self.MIN_TICKS_REQUIRED = max(long_ema, bb_period, rsi_period) + 1

    def prepare_tick_data(self, market):
        """Fetch and prepare tick data from database"""
        ticks = TickData.query.filter(
            TickData.market == market
        ).order_by(
            TickData.timestamp.desc()
        ).limit(self.TICK_WINDOW).all()
        
        ticks.reverse()  # Most recent last
        
        if len(ticks) < self.MIN_TICKS_REQUIRED:
            return None
            
        df = pd.DataFrame([(tick.price, tick.timestamp) for tick in ticks],
                         columns=['close', 'timestamp'])
        return self.calculate_indicators(df)

    def calculate_indicators(self, df):
        if len(df) < self.MIN_TICKS_REQUIRED:
            return None

        # Calculate EMAs on ticks
        df['short_ema'] = ta.trend.ema_indicator(df['close'], 
                                               window=self.short_ema)
        df['long_ema'] = ta.trend.ema_indicator(df['close'], 
                                              window=self.long_ema)
        
        # Calculate Bollinger Bands on ticks
        df['bb_middle'] = ta.volatility.bollinger_mavg(df['close'], 
                                                     window=self.bb_period)
        df['bb_upper'] = ta.volatility.bollinger_hband(df['close'], 
                                                     window=self.bb_period, 
                                                     window_dev=self.bb_std)
        df['bb_lower'] = ta.volatility.bollinger_lband(df['close'], 
                                                     window=self.bb_period, 
                                                     window_dev=self.bb_std)
        
        # Calculate RSI on ticks
        df['rsi'] = ta.momentum.rsi(df['close'], window=self.rsi_period)
        
        # Calculate Heikin Ashi
        df['ha_close'] = (df['close'] + df['close'].shift(1)) / 2
        df['ha_open'] = df['close'].shift(1)
        
        # Calculate tick momentum
        df['momentum'] = df['close'].diff()
        
        # Calculate tick volatility
        df['volatility'] = df['close'].rolling(window=10).std()
        
        return df

    def calculate_signal_strength(self, indicators):
        """Enhanced signal strength calculation for tick data"""
        signal_weights = {
            'ema': 0.25,      # 25% weight
            'bb': 0.20,       # 20% weight
            'rsi': 0.20,      # 20% weight
            'ha': 0.15,       # 15% weight
            'momentum': 0.10,  # 10% weight
            'volatility': 0.10 # 10% weight
        }
        
        # Calculate momentum score
        momentum_score = 100 if indicators['momentum'] > 0 else 0
        
        # Calculate volatility score (higher volatility = stronger signals)
        volatility_score = min(100, indicators['volatility'] * 100)
        
        signal_scores = {
            'ema': 100 if indicators['ema_signal'] else 0,
            'bb': 100 if indicators['bb_signal'] else 0,
            'rsi': self.calculate_rsi_score(indicators['rsi']),
            'ha': 100 if indicators['ha_signal'] else 0,
            'momentum': momentum_score,
            'volatility': volatility_score
        }
        
        total_strength = sum(signal_weights[k] * signal_scores[k] 
                           for k in signal_weights)
        return round(total_strength, 2)

    def calculate_rsi_score(self, rsi_value):
        """Convert RSI value to a signal score"""
        if rsi_value <= 30:
            # Strong buy signal (oversold)
            return 100
        elif rsi_value >= 70:
            # Strong sell signal (overbought)
            return 100
        else:
            # Neutral zone - decrease confidence linearly
            return 100 - (abs(50 - rsi_value) * 2.5)

    def generate_signal(self, market):
        df = self.prepare_tick_data(market)
        if df is None or df.empty:
            return 0, 0
        
        # Use last few ticks for trend confirmation
        last_ticks = df.tail(3)
        
        # Enhanced indicators for tick analysis
        indicators = {
            'ema_signal': all(row['short_ema'] > row['long_ema'] 
                             for _, row in last_ticks.iterrows()),
            'bb_signal': df.iloc[-1]['close'] < df.iloc[-1]['bb_lower'],
            'rsi': df.iloc[-1]['rsi'],
            'ha_signal': all(row['ha_close'] > row['ha_open'] 
                            for _, row in last_ticks.iterrows()),
            'momentum': df.iloc[-1]['momentum'],
            'volatility': df.iloc[-1]['volatility']
        }
        
        # Calculate signal strength
        signal_strength = self.calculate_signal_strength(indicators)
        
        # Generate trading signal
        if signal_strength >= self.SIGNAL_THRESHOLD:
            # Confirm trend direction with multiple indicators
            if (all(indicators.values())):
                return 1, signal_strength  # Strong buy signal
            elif (not any([indicators['ema_signal'], 
                         indicators['ha_signal']]) and 
                  indicators['rsi'] > 70):
                return -1, signal_strength  # Strong sell signal
        
        return 0, signal_strength

    def get_market_analysis(self, market):
        """Get current market analysis"""
        df = self.prepare_tick_data(market)
        if df is None or df.empty:
            return {
                'trend': 'Unknown',
                'volatility': 'Unknown',
                'signalStrength': 0,
                'phase': 'Unknown'
            }

        last_row = df.iloc[-1]
        
        # Determine trend
        trend = 'Bullish' if last_row['short_ema'] > last_row['long_ema'] else 'Bearish'
        
        # Calculate volatility
        volatility = 'High' if abs(last_row['close'] - last_row['bb_upper']) > \
                              abs(last_row['close'] - last_row['bb_lower']) else 'Low'
        
        # Calculate signal strength
        signal_strength = abs(last_row['rsi'] - 50) * 2  # 0-100%
        
        # Determine market phase
        if last_row['rsi'] < 30:
            phase = 'Oversold'
        elif last_row['rsi'] > 70:
            phase = 'Overbought'
        else:
            phase = 'Neutral'
        
        return {
            'trend': trend,
            'volatility': volatility,
            'signalStrength': signal_strength,
            'phase': phase
        } 