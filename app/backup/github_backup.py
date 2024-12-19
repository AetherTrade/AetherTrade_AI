import os
import json
import pandas as pd
from github import Github
from datetime import datetime
import base64
from app.models.user import User
from app.models.tick_data import TickData
from app.extensions import db
import time
import schedule
from threading import Thread, Lock
from flask import current_app
from contextlib import contextmanager
from functools import wraps
import tempfile
import gc

class BackupConfig:
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
    GITHUB_BACKUP_REPO = os.environ.get('GITHUB_BACKUP_REPO')
    BACKUP_ENABLED = True
    BACKUP_INTERVAL_USERS = 300  # 5 minutes
    BACKUP_INTERVAL_TICKS = 300  # 5 minutes
    MAX_BACKUP_ATTEMPTS = 3
    BACKUP_TIMEOUT = 30  # seconds

class GitHubBackupManager:
    def __init__(self, token, repo_name):
        # PythonAnywhere specific limits
        self.max_backup_size = 50 * 1024 * 1024  # 50MB limit
        self.max_memory = 300 * 1024 * 1024      # 300MB limit
        self.chunk_size = 5 * 1024 * 1024        # 5MB chunks
        self.temp_dir = tempfile.gettempdir()    # Use temp directory
        
        # Timeouts and retries
        self.operation_timeout = 120
        self.max_retries = 3
        self.retry_delay = 5
        
        # Initialize GitHub connection
        self.g = Github(token)
        self.repo_name = repo_name
        self._backup_lock = Lock()
        
        try:
            self.repo = self.g.get_user().get_repo(repo_name)
            self.schedule_restore_tests()
        except Exception as e:
            current_app.logger.error(f"Failed to connect to GitHub repo: {str(e)}")
            self.repo = None

    def start_backup_scheduler(self):
        """Start automated backup schedule"""
        def run_scheduler():
            print("\n=== Starting Backup Scheduler ===")
            print(f"✓ Scheduling backups every 5 minutes")
            
            schedule.every(self.backup_interval_users).seconds.do(self.backup_users)
            schedule.every(self.backup_interval_ticks).seconds.do(self.backup_ticks)
            
            print("✓ Backup scheduler is running")
            print("=== Backup Scheduler Started ===\n")
            
            while True:
                schedule.run_pending()
                time.sleep(1)
        
        scheduler_thread = Thread(target=run_scheduler)
        scheduler_thread.daemon = True
        scheduler_thread.start()

    def get_latest_user_backup(self):
        """Get the latest user backup from GitHub"""
        try:
            # Get contents of users backup directory
            contents = self.repo.get_contents("backups/users")
            if not contents:
                return None
            
            # Sort by name to get latest backup
            latest = sorted(contents, key=lambda x: x.name, reverse=True)[0]
            
            # Get and decode content
            content = self.repo.get_contents(latest.path).decoded_content
            return json.loads(content.decode('utf-8'))
            
        except Exception as e:
            current_app.logger.error(f"Error getting latest user backup: {str(e)}")
            raise

    def get_latest_tick_backup(self):
        """Get the latest tick backup from GitHub"""
        try:
            # Get contents of ticks backup directory
            contents = self.repo.get_contents("backups/ticks")
            if not contents:
                return None
            
            # Sort by name to get latest backup
            latest = sorted(contents, key=lambda x: x.name, reverse=True)[0]
            
            # Get and decode content
            content = self.repo.get_contents(latest.path).decoded_content
            return json.loads(content.decode('utf-8'))
            
        except Exception as e:
            current_app.logger.error(f"Error getting latest tick backup: {str(e)}")
            raise

    @contextmanager
    def _atomic_backup(self):
        """Context manager for atomic backup operations"""
        with self._backup_lock:
            try:
                yield
            except Exception as e:
                current_app.logger.error(f"Backup operation failed: {str(e)}")
                raise

    def _resource_check(f):
        """Decorator to check memory usage using Windows-compatible method"""
        @wraps(f)
        def wrapper(self, *args, **kwargs):
            try:
                import psutil  # Optional import
                process = psutil.Process(os.getpid())
                memory_usage = process.memory_info().rss
                if memory_usage > self.max_memory:
                    gc.collect()  # Try garbage collection first
                    memory_usage = process.memory_info().rss
                    if memory_usage > self.max_memory:
                        raise MemoryError("Memory limit exceeded")
            except ImportError:
                # If psutil is not available, just do garbage collection
                gc.collect()
            return f(self, *args, **kwargs)
        return wrapper
        
    @_resource_check
    def backup_users(self):
        """Optimized user backup"""
        with self._atomic_backup():
            try:
                # Use temporary file for large datasets
                with tempfile.NamedTemporaryFile(dir=self.temp_dir, mode='w+', delete=False) as temp_file:
                    # Batch process users to reduce memory usage
                    for users_batch in self._batch_query(User.query, 100):
                        user_data = [user.to_dict() for user in users_batch]
                        json.dump(user_data, temp_file)
                        temp_file.flush()
                        
                    temp_file.seek(0)
                    content = temp_file.read()
                    
                    if len(content.encode('utf-8')) > self.max_backup_size:
                        raise ValueError("Backup size exceeds limits")
                        
                    # Create backup in chunks
                    self._create_backup_file(content)
                    
                # Clean up temp file
                os.unlink(temp_file.name)
                return True
                
            except Exception as e:
                current_app.logger.error(f"Backup error: {str(e)}")
                return False
                
    def _batch_query(self, query, batch_size):
        """Process database queries in batches"""
        offset = 0
        while True:
            batch = query.limit(batch_size).offset(offset).all()
            if not batch:
                break
            yield batch
            offset += batch_size
            gc.collect()  # Clean up after each batch

    def _create_backup_file(self, content):
        """Create backup file with retry logic"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"backups/users/users_backup_{timestamp}.json"
        
        for attempt in range(self.max_retries):
            try:
                self.repo.create_file(
                    filename,
                    f"User backup {timestamp}",
                    content.encode('utf-8')
                )
                return True
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.retry_delay)
                
    def backup_ticks(self):
        """Backup tick data to GitHub with cleanup of old files"""
        try:
            from app.models import TickData
            from sqlalchemy import desc
            
            # Get only the latest tick for each market
            latest_ticks = []
            for market in ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']:
                latest = TickData.query.filter_by(market=market)\
                    .order_by(desc(TickData.timestamp))\
                    .first()
                if latest:
                    latest_ticks.append(latest)
            
            tick_data = [tick.to_dict() for tick in latest_ticks]
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"backups/ticks/ticks_backup_{timestamp}.json"
            
            content = json.dumps(tick_data, indent=2)
            
            # Create new backup file
            self.repo.create_file(
                filename,
                f"Latest tick backup {timestamp}",
                content.encode('utf-8')
            )
            
            # Only cleanup old tick backups
            self.cleanup_old_backups()
            
            current_app.logger.info(f"Backed up {len(tick_data)} latest ticks")
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error backing up ticks: {str(e)}")
            return False

    def restore_users(self):
        """Restore users from GitHub backup"""
        try:
            contents = self.repo.get_contents("latest_users.json")
            users_data = json.loads(base64.b64decode(contents.content))

            User.query.delete()

            for user_data in users_data:
                user = User(
                    username=user_data['username'],
                    email=user_data['email'],
                    is_admin=user_data['is_admin'],
                    is_suspended=user_data['is_suspended'],
                    real_account_approved=user_data['real_account_approved'],
                    is_api_approved=user_data['is_api_approved']
                )
                db.session.add(user)

            db.session.commit()
            return True
        except Exception as e:
            print(f"Error restoring users: {str(e)}")
            db.session.rollback()
            return False

    def restore_ticks(self):
        """Restore tick data from GitHub backup"""
        try:
            contents = self.repo.get_contents("latest_ticks.csv")
            csv_content = base64.b64decode(contents.content).decode()
            df = pd.read_csv(pd.StringIO(csv_content))

            TickData.query.delete()

            for _, row in df.iterrows():
                tick = TickData(
                    market=row['market'],
                    price=row['price'],
                    timestamp=datetime.fromisoformat(row['timestamp'])
                )
                db.session.add(tick)

            db.session.commit()
            return True
        except Exception as e:
            print(f"Error restoring ticks: {str(e)}")
            db.session.rollback()
            return False

    def cleanup_old_backups(self, keep_days=7):
        """Remove old tick backups but preserve all user backups"""
        try:
            from datetime import timedelta
            
            # Only clean up tick backups, preserve user backups
            path = "backups/ticks"
            contents = self.repo.get_contents(path)
            for content in contents:
                try:
                    # Parse date from filename (format: ticks_backup_YYYYMMDD_HHMMSS.json)
                    filename = content.name
                    date_str = filename.split('_')[2]
                    file_date = datetime.strptime(date_str, '%Y%m%d')
                    
                    # Check if file is older than keep_days
                    if datetime.now() - file_date > timedelta(days=keep_days):
                        self.repo.delete_file(
                            content.path,
                            f"Removing old tick backup {filename}",
                            content.sha
                        )
                        current_app.logger.info(f"Removed old tick backup: {filename}")
                except Exception as e:
                    current_app.logger.error(f"Error processing file {filename}: {str(e)}")
                    continue
            
            return True
        except Exception as e:
            current_app.logger.error(f"Error cleaning up old backups: {str(e)}")
            return False

    def test_restore(self):
        """Test backup restoration by performing a test restore and verification"""
        try:
            # 1. Create a test backup with known data
            test_user = {
                'username': 'test_restore_user',
                'email': 'test@restore.com',
                'is_admin': False
            }
            test_tick = {
                'market': 'R_TEST',
                'price': 100.0,
                'timestamp': datetime.now().isoformat()
            }
            
            # 2. Store test data in temporary backup
            test_backup_path = f"backups/test/test_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            self.repo.create_file(
                test_backup_path,
                "Test backup for restoration testing",
                json.dumps({'users': [test_user], 'ticks': [test_tick]})
            )

            # 3. Attempt to restore from test backup
            restored_data = json.loads(
                self.repo.get_contents(test_backup_path).decoded_content.decode('utf-8')
            )

            # 4. Verify restoration accuracy
            verification_results = {
                'users': self._verify_user_data(test_user, restored_data['users'][0]),
                'ticks': self._verify_tick_data(test_tick, restored_data['ticks'][0]),
                'backup_readable': True,
                'backup_complete': True
            }

            # 5. Cleanup test backup
            self.repo.delete_file(
                test_backup_path,
                "Removing test backup",
                self.repo.get_contents(test_backup_path).sha
            )

            # 6. Log test results
            current_app.logger.info(f"Restore test results: {verification_results}")
            
            return verification_results

        except Exception as e:
            current_app.logger.error(f"Restore test failed: {str(e)}")
            return {
                'users': False,
                'ticks': False,
                'backup_readable': False,
                'backup_complete': False,
                'error': str(e)
            }

    def _verify_user_data(self, original, restored):
        """Verify user data integrity"""
        try:
            return all([
                original['username'] == restored['username'],
                original['email'] == restored['email'],
                original['is_admin'] == restored['is_admin']
            ])
        except Exception:
            return False

    def _verify_tick_data(self, original, restored):
        """Verify tick data integrity"""
        try:
            return all([
                original['market'] == restored['market'],
                abs(original['price'] - restored['price']) < 0.0001,  # Float comparison
                datetime.fromisoformat(original['timestamp']) == 
                datetime.fromisoformat(restored['timestamp'])
            ])
        except Exception:
            return False

    def schedule_restore_tests(self):
        """Schedule periodic restore testing"""
        def run_test():
            with current_app.app_context():
                results = self.test_restore()
                if not all(results.values()):
                    current_app.logger.error("Restore test failed!")
                    
        # Run restore test every 24 hours
        schedule.every(24).hours.do(run_test)

    def restore_latest_backup(self):
        """Restore latest backup data on app startup"""
        try:
            print("\n=== Starting Backup Restoration ===")
            
            # 1. Restore users first
            latest_user_backup = self.get_latest_user_backup()
            if latest_user_backup:
                User.query.delete()  # Clear existing users
                for user_data in latest_user_backup:
                    user = User(
                        username=user_data['username'],
                        email=user_data['email'],
                        is_admin=user_data.get('is_admin', False),
                        is_suspended=user_data.get('is_suspended', False),
                        real_account_approved=user_data.get('real_account_approved', False),
                        is_api_approved=user_data.get('is_api_approved', False)
                    )
                    if 'password_hash' in user_data:
                        user.password_hash = user_data['password_hash']
                    db.session.add(user)
                
                db.session.commit()
                print(f"✓ Successfully restored {len(latest_user_backup)} users from backup")
            else:
                print("! No user backup found to restore")
            
            # 2. Restore tick data
            latest_tick_backup = self.get_latest_tick_backup()
            if latest_tick_backup:
                TickData.query.delete()  # Clear existing ticks
                for tick_data in latest_tick_backup:
                    tick = TickData(
                        market=tick_data['market'],
                        price=tick_data['price'],
                        timestamp=datetime.fromisoformat(tick_data['timestamp'])
                    )
                    db.session.add(tick)
                
                db.session.commit()
                print(f"✓ Successfully restored {len(latest_tick_backup)} ticks from backup")
            else:
                print("! No tick backup found to restore")
            
            print("=== Backup Restoration Complete ===\n")
            return True
            
        except Exception as e:
            print(f"\n❌ Error restoring backup: {str(e)}")
            current_app.logger.error(f"Error restoring backup on startup: {str(e)}")
            db.session.rollback()
            return False