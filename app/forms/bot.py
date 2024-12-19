from app.constants import AVAILABLE_MARKETS, MARKET_NAMES
from wtforms import SelectField

class BotSettingsForm(FlaskForm):
    selected_market = SelectField('Market', 
        choices=[(market, MARKET_NAMES[market]) for market in AVAILABLE_MARKETS],
        default='R_50'
    )
    # ... rest of your form fields ...