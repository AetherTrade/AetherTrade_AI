from app import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app
from datetime import datetime
from time import time
import jwt

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    deriv_api_key = db.Column(db.String(256))
    is_admin = db.Column(db.Boolean, default=False)
    is_suspended = db.Column(db.Boolean, default=False)
    suspension_reason = db.Column(db.String(256))
    suspension_duration = db.Column(db.Integer)
    suspended_at = db.Column(db.DateTime)
    must_change_password = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime)
    real_account_approved = db.Column(db.Boolean, default=False)
    approval_status = db.Column(db.String(20))
    approval_date = db.Column(db.DateTime)
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    is_api_approved = db.Column(db.Boolean, default=False)
    api_account_type = db.Column(db.String(10))
    api_key_updated_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add relationship to UserActivity
    activities = db.relationship('UserActivity', backref='user', lazy='dynamic')

    def __init__(self, *args, **kwargs):
        super(User, self).__init__(*args, **kwargs)
        self.last_login = datetime.utcnow()

    def set_password(self, password):
        if not password:
            raise ValueError("Password cannot be empty")
        try:
            self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')
            if not self.password_hash:
                raise ValueError("Password hash generation failed")
        except Exception as e:
            raise ValueError(f"Password hashing error: {str(e)}")

    def check_password(self, password):
        if not self.password_hash:
            return False
        try:
            return check_password_hash(self.password_hash, password)
        except Exception:
            return False

    def get_reset_password_token(self, expires_in=3600):
        return jwt.encode(
            {'reset_password': self.id, 'exp': time() + expires_in},
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )

    @staticmethod
    def verify_reset_password_token(token):
        try:
            id = jwt.decode(token, current_app.config['SECRET_KEY'],
                           algorithms=['HS256'])['reset_password']
        except:
            return None
        return User.query.get(id)

    @property
    def is_active(self):
        return not self.is_suspended

    @staticmethod
    def create_admin(username, email, password):
        """Create an admin user"""
        try:
            admin = User(username=username, email=email)
            admin.set_password(password)
            admin.is_admin = True
            admin.real_account_approved = True
            admin.is_api_approved = True
            admin.approval_status = 'approved'
            admin.approval_date = datetime.utcnow()
            db.session.add(admin)
            db.session.commit()
            return admin
        except Exception as e:
            db.session.rollback()
            raise e

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'deriv_api_key': bool(self.deriv_api_key),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))

def generate_reset_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='password-reset-salt')

def verify_reset_token(token, expires_sec=3600):
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = s.loads(token, salt='password-reset-salt', max_age=expires_sec)
        return email
    except (SignatureExpired, BadSignature):
        return None