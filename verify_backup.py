from app import create_app
from flask import current_app
import json
from datetime import datetime

app = create_app()

def verify_backup():
    with app.app_context():
        print(f"\nVerifying latest backup at {datetime.now()}")
        backup_manager = current_app.backup_scheduler.backup_manager
        
        print("\nChecking latest user backup...")
        try:
            user_backup = backup_manager.get_latest_user_backup()
            print(f"✓ Found user backup with {len(user_backup)} users")
            print("Sample user data (admin):")
            admin = next((user for user in user_backup if user.get('is_admin')), None)
            if admin:
                print(f"  Username: {admin.get('username')}")
                print(f"  Email: {admin.get('email')}")
                print(f"  Created: {admin.get('created_at')}")
        except Exception as e:
            print(f"✗ Error reading user backup: {str(e)}")
            
        print("\nChecking latest tick backup...")
        try:
            tick_backup = backup_manager.get_latest_tick_backup()
            print(f"✓ Found tick backup with {len(tick_backup)} ticks")
            print("Latest tick data:")
            for market in ['R_100', 'R_75', 'R_50']:
                tick = next((t for t in tick_backup if t.get('market') == market), None)
                if tick:
                    print(f"  {market}: {tick.get('price')} @ {tick.get('timestamp')}")
        except Exception as e:
            print(f"✗ Error reading tick backup: {str(e)}")

if __name__ == "__main__":
    verify_backup() 