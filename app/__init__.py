from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_mail import Mail
from config import Config
import logging
from logging.handlers import RotatingFileHandler
import os
from app.extensions import db, migrate, login_manager, mail, csrf
from app.cli import add_api_column, approve_admin_api
from app.routes.deriv_api import deriv_api_bp
from flask_socketio import SocketIO
from .websocket import socketio
from app.routes.bot import bot_bp
from app.collectors.tick_collector import ServerTickCollector
import asyncio
import threading
import atexit

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Print email configuration (temporarily, for debugging)
    print("Email Configuration:")
    print(f"MAIL_SERVER: {app.config['MAIL_SERVER']}")
    print(f"MAIL_PORT: {app.config['MAIL_PORT']}")
    print(f"MAIL_USE_TLS: {app.config['MAIL_USE_TLS']}")
    print(f"MAIL_USERNAME: {app.config['MAIL_USERNAME']}")
    print(f"MAIL_DEFAULT_SENDER: {app.config['MAIL_DEFAULT_SENDER']}")
    
    # WebSocket settings
    app.config['SOCKETIO_ASYNC_MODE'] = 'gevent'
    app.config['SOCKETIO_PING_TIMEOUT'] = 10
    app.config['SOCKETIO_PING_INTERVAL'] = 5

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    mail.init_app(app)
    csrf.init_app(app)

    # Initialize SocketIO with CORS and WebSocket transport
    socketio.init_app(app,
                     cors_allowed_origins="*",
                     async_mode='threading',
                     transport=['websocket', 'polling'],
                     ping_timeout=10,
                     ping_interval=5)

    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'

    # Import blueprints
    from app.routes.auth import auth
    from app.routes.main import main
    from app.routes.dashboard import dashboard_bp
    from app.routes.admin import admin_bp
    from app.routes.api import api_bp

    # Register blueprints
    app.register_blueprint(auth, url_prefix='/auth')
    app.register_blueprint(main)
    app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(api_bp)
    app.register_blueprint(deriv_api_bp)
    app.register_blueprint(bot_bp)

    from .cli import create_admin
    app.cli.add_command(create_admin)

    from app.utils import inject_csrf_token
    app.context_processor(inject_csrf_token)

    app.cli.add_command(add_api_column)
    app.cli.add_command(approve_admin_api)

    # Add these new lines for admin commands
    from app.commands import list_admins_command, create_admin_command
    app.cli.add_command(list_admins_command)
    app.cli.add_command(create_admin_command)

    # Register WebSocket error handlers
    @socketio.on_error()
    def error_handler(e):
        print('WebSocket error:', str(e))

    @socketio.on_error_default
    def default_error_handler(e):
        print('WebSocket default error:', str(e))

    # Initialize and start tick collector
    with app.app_context():
        tick_collector = ServerTickCollector(app)
        tick_collector.start()

    # Ensure proper cleanup on application shutdown
    atexit.register(lambda: tick_collector.stop() if tick_collector else None)

    with app.app_context():
        # Create tables if they don't exist
        db.create_all()

    return app 
    