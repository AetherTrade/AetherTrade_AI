from app import create_app
from flask import current_app
from datetime import datetime

app = create_app()

def force_tick_backup():
    with app.app_context():
        print(f"\nForcing tick backup at {datetime.now()}")
        backup_manager = current_app.backup_scheduler.backup_manager
        
        print("\nBacking up latest ticks...")
        if backup_manager.backup_ticks():
            print("✓ Tick backup successful")
            
            # Verify the new backup
            tick_backup = backup_manager.get_latest_tick_backup()
            print(f"\nLatest tick data:")
            for market in ['R_100', 'R_75', 'R_50']:
                tick = next((t for t in tick_backup if t.get('market') == market), None)
                if tick:
                    print(f"  {market}: {tick.get('price')} @ {tick.get('timestamp')}")
        else:
            print("✗ Tick backup failed")

if __name__ == "__main__":
    force_tick_backup() 