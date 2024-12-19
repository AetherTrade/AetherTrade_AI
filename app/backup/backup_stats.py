from threading import RLock
from datetime import datetime, timedelta

class BackupStats:
    def __init__(self, backup_manager):
        self.backup_manager = backup_manager
        self._stats_lock = RLock()  # Reentrant lock for nested operations
        self._stats_cache = {}
        self._cache_timestamp = None
        self._cache_duration = timedelta(minutes=5)  # Cache stats for 5 minutes

    def get_backup_stats(self):
        """Get comprehensive backup statistics with thread-safe caching"""
        with self._stats_lock:
            current_time = datetime.now()
            
            # Return cached stats if still valid
            if (self._cache_timestamp and 
                current_time - self._cache_timestamp < self._cache_duration):
                return self._stats_cache.copy()  # Return a copy to prevent external modification
            
            try:
                stats = {
                    'users': {
                        'total_backups': 0,
                        'total_users': 0,
                        'latest_backup': None,
                        'oldest_backup': None
                    },
                    'ticks': {
                        'total_backups': 0,
                        'markets_covered': set(),
                        'latest_backup': None,
                        'retention_days': 7
                    }
                }
                
                # Fetch stats with proper error handling
                user_contents = self.backup_manager.repo.get_contents("backups/users")
                if user_contents:
                    stats['users']['total_backups'] = len(user_contents)
                    latest_user_backup = json.loads(user_contents[-1].decoded_content.decode('utf-8'))
                    stats['users']['total_users'] = len(latest_user_backup)
                    stats['users']['latest_backup'] = user_contents[-1].name
                    stats['users']['oldest_backup'] = user_contents[0].name

                # Update cache
                self._stats_cache = stats
                self._cache_timestamp = current_time
                
                return stats.copy()  # Return a copy to prevent external modification
                
            except Exception as e:
                current_app.logger.error(f"Error getting backup stats: {str(e)}")
                return None 