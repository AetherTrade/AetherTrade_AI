from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from app.backup.github_backup import GitHubBackupManager
import logging
from threading import Event

class BackupScheduler:
    def __init__(self, app):
        self.app = app
        self.scheduler = BackgroundScheduler(
            # PythonAnywhere optimized settings
            job_defaults={
                'coalesce': True,  # Combine missed jobs
                'max_instances': 1, # Prevent job overlap
                'misfire_grace_time': 60 * 5  # 5 minute grace period
            }
        )
        
        # Add error listener
        self.scheduler.add_listener(
            self._handle_job_error,
            EVENT_JOB_ERROR
        )
        
        self.backup_manager = GitHubBackupManager(
            app.config['GITHUB_TOKEN'],
            app.config['GITHUB_BACKUP_REPO']
        )
        self.logger = app.logger
        self.intervals = app.config['BACKUP_INTERVALS']
        self._shutdown_event = Event()
        
    def _handle_job_error(self, event):
        """Handle job failures"""
        job = self.scheduler.get_job(event.job_id)
        if job:
            current_app.logger.error(
                f"Backup job {job.id} failed: {event.exception}"
            )
            # Notify admin or take corrective action
            
    def start(self):
        """Start scheduler with PythonAnywhere considerations"""
        try:
            # Add jobs with more conservative intervals
            self.scheduler.add_job(
                func=self._backup_users,
                trigger='interval',
                minutes=15,  # Longer interval
                id='user_backup',
                max_instances=1
            )
            
            self.scheduler.start()
            current_app.logger.info('Backup scheduler started with PythonAnywhere optimizations')
            
        except Exception as e:
            current_app.logger.error(f'Scheduler error: {str(e)}')
    
    def _backup_users(self):
        """Perform user backup"""
        try:
            with self.app.app_context():  # Ensure we're in app context
                success = self.backup_manager.backup_users()
                if success:
                    self.logger.info('Scheduled user backup completed successfully')
                else:
                    self.logger.error('Scheduled user backup failed')
        except Exception as e:
            self.logger.error(f'Error in scheduled user backup: {str(e)}')
    
    def _backup_ticks(self):
        """Perform tick data backup"""
        try:
            with self.app.app_context():  # Ensure we're in app context
                success = self.backup_manager.backup_ticks()
                if success:
                    self.logger.info('Scheduled tick backup completed successfully')
                else:
                    self.logger.error('Scheduled tick backup failed')
        except Exception as e:
            self.logger.error(f'Error in scheduled tick backup: {str(e)}')
    
    def stop(self):
        """Gracefully stop the scheduler"""
        self._shutdown_event.set()
        self.scheduler.shutdown(wait=True)
        self.logger.info('Backup scheduler stopped gracefully')
    
    def update_interval(self, backup_type, seconds):
        """Update backup interval dynamically"""
        try:
            if backup_type not in self.intervals:
                raise ValueError(f"Invalid backup type: {backup_type}")
                
            # Validate interval is within allowed range
            min_interval = self.intervals[backup_type]['min']
            max_interval = self.intervals[backup_type]['max']
            
            if not min_interval <= seconds <= max_interval:
                raise ValueError(f"Interval must be between {min_interval} and {max_interval} seconds")
                
            # Update the job
            job_id = f'{backup_type}_backup'
            self.scheduler.reschedule_job(
                job_id,
                trigger='interval',
                seconds=seconds
            )
            
            self.logger.info(f'Updated {backup_type} backup interval to {seconds} seconds')
            return True
            
        except Exception as e:
            self.logger.error(f'Error updating backup interval: {str(e)}')
            return False 