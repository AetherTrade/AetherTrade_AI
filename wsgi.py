from flask import Flask, request
from flask_socketio import SocketIO
from app import create_app, socketio, db
from app.models import User
import os

# Configure for gevent
socketio.server_options['async_mode'] = 'gevent'
socketio.server_options['worker_class'] = 'gevent'
socketio.server_options['workers'] = 1

application = create_app()

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    socketio.emit('connection_response', {'data': 'Connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on_error_default
def default_error_handler(e):
    print('SocketIO Error:', str(e))

@application.route('/setup-admin/<secret_key>')
def setup_admin(secret_key):
    if secret_key != "70605040@AetherSetup":
        return "Unauthorized", 401
    
    try:
        with application.app_context():
            admin = User.query.filter_by(email='aetheradmin@aethertrade.ai').first()
            if admin:
                return "Admin already exists"
            
            admin = User(
                username='AetherAdmin',
                email='aetheradmin@aethertrade.ai',
                is_admin=True
            )
            admin.set_password('70605040@Aether')
            db.session.add(admin)
            db.session.commit()
            return "Admin created successfully"
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(application,
                debug=False,
                host='0.0.0.0',
                port=port,
                allow_unsafe_werkzeug=True,
                async_mode='gevent')