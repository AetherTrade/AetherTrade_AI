from app import db
from datetime import datetime

class BotSettings(db.Model):
    __tablename__ = 'bot_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    initial_stake = db.Column(db.Float, default=1.0)
    martingale_multiplier = db.Column(db.Float, default=2.0)
    max_losses = db.Column(db.Integer, default=3)
    selected_market = db.Column(db.String(20), default='R_50')
    is_active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    strategy_short_ema = db.Column(db.Integer, default=3)
    strategy_long_ema = db.Column(db.Integer, default=6)
    strategy_bb_period = db.Column(db.Integer, default=14)
    strategy_bb_std = db.Column(db.Float, default=2.0)
    strategy_rsi_period = db.Column(db.Integer, default=7)

    def __repr__(self):
        return f'<BotSettings {self.user_id}>'

class BotTrade(db.Model):
    __tablename__ = 'bot_trades'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    market = db.Column(db.String(20), nullable=False)
    stake = db.Column(db.Float, nullable=False)
    trade_type = db.Column(db.String(10), nullable=False)  # CALL or PUT
    outcome = db.Column(db.String(10), nullable=False)  # win or lose
    profit_loss = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<BotTrade {self.id} {self.market} {self.outcome}>' 