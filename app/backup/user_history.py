from datetime import datetime
import json

class UserHistoryViewer:
    def __init__(self, backup_manager):
        self.backup_manager = backup_manager

    def get_user_history(self, username):
        """Get complete history of a user across all backups"""
        try:
            contents = self.backup_manager.repo.get_contents("backups/users")
            history = []
            
            for content in contents:
                backup_data = json.loads(content.decoded_content.decode('utf-8'))
                user_data = next((user for user in backup_data if user['username'] == username), None)
                if user_data:
                    # Add backup timestamp from filename
                    timestamp = content.name.split('_')[2:4]  # Get YYYYMMDD_HHMMSS
                    user_data['backup_date'] = '_'.join(timestamp)
                    history.append(user_data)
            
            return sorted(history, key=lambda x: x['backup_date'], reverse=True)
        except Exception as e:
            current_app.logger.error(f"Error getting user history: {str(e)}")
            return [] 