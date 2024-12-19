import os

class BackupConfig:
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
    GITHUB_BACKUP_REPO = os.environ.get('GITHUB_BACKUP_REPO')
    BACKUP_ENABLED = True
    BACKUP_INTERVAL_USERS = 300  # 5 minutes
    BACKUP_INTERVAL_TICKS = 600  # 10 minutes
    MAX_BACKUP_ATTEMPTS = 3
    BACKUP_TIMEOUT = 30  # seconds