from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
from app.models.bot import BotSettings, BotTrade
from app import db
from app.strategies.hybrid_strategy import HybridTradingStrategy
import json

bot_bp = Blueprint('bot', __name__)

@bot_bp.route('/api/bot/settings', methods=['GET', 'POST'])
@login_required
def bot_settings():
    if request.method == 'POST':
        data = request.get_json()
        
        # Get or create bot settings for current user
        settings = BotSettings.query.filter_by(user_id=current_user.id).first()
        if not settings:
            settings = BotSettings(user_id=current_user.id)
            
        # Update settings
        settings.initial_stake = data.get('initialStake', 1)
        settings.martingale_multiplier = data.get('martingaleMultiplier', 2)
        settings.max_losses = data.get('maxLosses', 3)
        settings.selected_market = data.get('selectedMarket', 'R_50')
        
        db.session.add(settings)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Settings updated successfully'})
    
    # GET request - return current settings
    settings = BotSettings.query.filter_by(user_id=current_user.id).first()
    if settings:
        return jsonify({
            'initialStake': settings.initial_stake,
            'martingaleMultiplier': settings.martingale_multiplier,
            'maxLosses': settings.max_losses,
            'selectedMarket': settings.selected_market
        })
    
    return jsonify({
        'initialStake': 1,
        'martingaleMultiplier': 2,
        'maxLosses': 3,
        'selectedMarket': 'R_50'
    })

@bot_bp.route('/api/bot/trades', methods=['GET', 'POST'])
@login_required
def bot_trades():
    if request.method == 'POST':
        data = request.get_json()
        
        trade = BotTrade(
            user_id=current_user.id,
            market=data.get('market'),
            stake=data.get('stake'),
            trade_type=data.get('tradeType'),
            outcome=data.get('outcome'),
            profit_loss=data.get('profitLoss')
        )
        
        db.session.add(trade)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Trade recorded successfully'})
    
    # GET request - return trade history
    trades = BotTrade.query.filter_by(user_id=current_user.id)\
        .order_by(BotTrade.timestamp.desc())\
        .limit(100)\
        .all()
    
    return jsonify([{
        'id': trade.id,
        'market': trade.market,
        'stake': trade.stake,
        'tradeType': trade.trade_type,
        'outcome': trade.outcome,
        'profitLoss': trade.profit_loss,
        'timestamp': trade.timestamp.isoformat()
    } for trade in trades])

@bot_bp.route('/api/bot/statistics', methods=['GET'])
@login_required
def bot_statistics():
    trades = BotTrade.query.filter_by(user_id=current_user.id).all()
    
    total_trades = len(trades)
    winning_trades = len([t for t in trades if t.outcome == 'win'])
    total_profit = sum([t.profit_loss for t in trades])
    
    return jsonify({
        'totalTrades': total_trades,
        'winningTrades': winning_trades,
        'winRate': (winning_trades / total_trades * 100) if total_trades > 0 else 0,
        'totalProfit': total_profit
    }) 

@bot_bp.route('/api/bot/strategy/settings', methods=['GET', 'POST'])
@login_required
def strategy_settings():
    if request.method == 'POST':
        data = request.get_json()
        settings = BotSettings.query.filter_by(user_id=current_user.id).first()
        
        if not settings:
            settings = BotSettings(user_id=current_user.id)
        
        # Update strategy settings
        settings.strategy_short_ema = data.get('shortEma', 3)
        settings.strategy_long_ema = data.get('longEma', 6)
        settings.strategy_bb_period = data.get('bbPeriod', 14)
        settings.strategy_bb_std = data.get('bbStd', 2.0)
        settings.strategy_rsi_period = data.get('rsiPeriod', 7)
        
        db.session.add(settings)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Strategy settings updated'})
    
    # GET request - return current settings
    settings = BotSettings.query.filter_by(user_id=current_user.id).first()
    if settings:
        return jsonify({
            'shortEma': settings.strategy_short_ema,
            'longEma': settings.strategy_long_ema,
            'bbPeriod': settings.strategy_bb_period,
            'bbStd': settings.strategy_bb_std,
            'rsiPeriod': settings.strategy_rsi_period
        })
    
    return jsonify({
        'shortEma': 3,
        'longEma': 6,
        'bbPeriod': 14,
        'bbStd': 2.0,
        'rsiPeriod': 7
    })

@bot_bp.route('/api/bot/analysis/<market>', methods=['GET'])
@login_required
def market_analysis(market):
    strategy = HybridTradingStrategy()
    analysis = strategy.get_market_analysis(market)
    return jsonify(analysis) 