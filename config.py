import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import secrets

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False 
    
    # Mail settings
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    
    # Security
    WTF_CSRF_ENABLED = True
    WTF_CSRF_SECRET_KEY = os.environ.get('CSRF_SECRET_KEY') or secrets.token_hex(32)
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY') or Fernet.generate_key()
    
    # Backup Configuration
    BACKUP_ENABLED = os.environ.get('BACKUP_ENABLED', 'True').lower() == 'true'
    GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
    GITHUB_BACKUP_REPO = os.environ.get('GITHUB_BACKUP_REPO')
    BACKUP_INTERVALS = {
        'users': {
            'default': int(os.environ.get('BACKUP_INTERVAL_USERS', 21600)),
            'min': 300,  # 5 minutes
            'max': 86400  # 24 hours
        },
        'ticks': {
            'default': int(os.environ.get('BACKUP_INTERVAL_TICKS', 3600)),
            'min': 300,  # 5 minutes
            'max': 43200  # 12 hours
        }
    }