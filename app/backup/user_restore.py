class UserRestoreManager:
    def __init__(self, backup_manager):
        self.backup_manager = backup_manager

    def list_available_backups(self, username):
        """List all backups containing data for a specific user"""
        try:
            contents = self.backup_manager.repo.get_contents("backups/users")
            available_backups = []
            
            for content in contents:
                backup_data = json.loads(content.decoded_content.decode('utf-8'))
                if any(user['username'] == username for user in backup_data):
                    backup_info = {
                        'filename': content.name,
                        'date': content.name.split('_')[2:4],
                        'sha': content.sha
                    }
                    available_backups.append(backup_info)
            
            return sorted(available_backups, key=lambda x: x['date'], reverse=True)
        except Exception as e:
            current_app.logger.error(f"Error listing available backups: {str(e)}")
            return []

    def restore_user_from_backup(self, username, backup_sha):
        """Restore user data from a specific backup"""
        try:
            from app.models import User
            from app import db

            # Get the specific backup content
            contents = self.backup_manager.repo.get_contents("backups/users")
            backup_content = next((c for c in contents if c.sha == backup_sha), None)
            
            if not backup_content:
                raise ValueError("Backup not found")

            backup_data = json.loads(backup_content.decoded_content.decode('utf-8'))
            user_data = next((user for user in backup_data if user['username'] == username), None)
            
            if not user_data:
                raise ValueError("User not found in backup")

            # Update or create user
            user = User.query.filter_by(username=username).first()
            if not user:
                user = User(username=user_data['username'], email=user_data['email'])
            
            # Update user attributes
            for key, value in user_data.items():
                if hasattr(user, key) and key not in ['id', 'password_hash']:
                    setattr(user, key, value)

            db.session.add(user)
            db.session.commit()
            
            return True, "User restored successfully"
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error restoring user: {str(e)}")
            return False, str(e) 