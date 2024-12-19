from app import create_app
from flask import current_app
from datetime import datetime

app = create_app()

def manual_backup():
    with app.app_context():
        print(f"\nStarting manual backup at {datetime.now()}")
        backup_manager = current_app.backup_scheduler.backup_manager
        
        print("\nBacking up users...")
        if backup_manager.backup_users():
            print("✓ User backup successful")
        else:
            print("✗ User backup failed")
            
        print("\nBacking up ticks...")
        if backup_manager.backup_ticks():
            print("✓ Tick backup successful")
        else:
            print("✗ Tick backup failed")
            
        print("\nBackup completed. Check GitHub repository for new files.")

if __name__ == "__main__":
    manual_backup() 