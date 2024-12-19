from app.extensions import db
from datetime import datetime

class TickData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    market = db.Column(db.String(10), nullable=False)
    price = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_market_timestamp', 'market', 'timestamp'),
    )

    def to_dict(self):
        """Convert tick data to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'market': self.market,
            'price': self.price,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

    def __repr__(self):
        return f'<TickData {self.market} @ {self.price}>'