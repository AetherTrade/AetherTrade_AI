from app import db, create_app
from app.models import User
from datetime import datetime

def init_db():
    app = create_app()
    with app.app_context():
        # Drop all existing tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        # Create admin user
        admin = User(
            username='admin',
            email='admin@aethertrade.ai',
            is_admin=True,
            api_account_type=None,
            api_key_updated_at=None,
            is_api_approved=False,
            real_account_approved=False
        )
        admin.set_password('admin123')  # Make sure to change this in production!
        
        db.session.add(admin)
        db.session.commit()
        
        print("Database initialized successfully!")
        print("Admin user created with username: 'admin' and password: 'admin123'")

if __name__ == '__main__':
    init_db() 