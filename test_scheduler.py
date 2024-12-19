from app import create_app
import time
from flask import current_app

app = create_app()

def test_backup():
    with app.app_context():
        print("Starting backup test...")
        try:
            backup_manager = current_app.backup_scheduler.backup_manager
            
            # Test user backup
            print("\nTesting user backup...")
            if backup_manager.backup_users():
                print("✓ User backup successful")
            else:
                print("✗ User backup failed")
            
            # Test tick backup
            print("\nTesting tick backup...")
            if backup_manager.backup_ticks():
                print("✓ Tick backup successful")
            else:
                print("✗ Tick backup failed")
                
            print("\nBackup test completed. Check your GitHub repository for the backup files.")
            
        except Exception as e:
            print(f"\nError during backup test: {str(e)}")
        
        print("\nTest finished.")

if __name__ == '__main__':
    test_backup() 