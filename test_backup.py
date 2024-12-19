from app.backup.github_backup import GitHubBackupManager
from app import create_app
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_backup_system():
    try:
        # Create Flask app and context
        app = create_app()
        
        with app.app_context():
            # Initialize backup manager
            backup_manager = GitHubBackupManager(
                os.getenv('GITHUB_TOKEN'),
                os.getenv('GITHUB_BACKUP_REPO')
            )
            
            print("Testing backup system...")
            
            # Test user backup
            print("\nTesting user backup:")
            users_success = backup_manager.backup_users()
            print(f"{'✓' if users_success else '✗'} User backup {'successful' if users_success else 'failed'}")
            
            # Test tick data backup
            print("\nTesting tick data backup:")
            ticks_success = backup_manager.backup_ticks()
            print(f"{'✓' if ticks_success else '✗'} Tick data backup {'successful' if ticks_success else 'failed'}")
            
            return users_success and ticks_success
            
    except Exception as e:
        print(f"\n✗ Error during backup test: {str(e)}")
        return False

if __name__ == "__main__":
    test_backup_system()