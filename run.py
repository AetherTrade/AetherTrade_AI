from flask import Flask
from flask_socketio import SocketIO
from app import create_app, db, socketio
from app.models import User

app = create_app()

@app.route('/setup-admin/<secret_key>')
def setup_admin(secret_key):
    if secret_key != "70605040@AetherSetup":  # Different from your admin password
        return "Unauthorized", 401
    
    try:
        with app.app_context():
            # Check if admin already exists
            admin = User.query.filter_by(email='aetheradmin@aethertrade.ai').first()
            if admin:
                return "Admin already exists"
            
            # Create new admin
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

if __name__ == '__main__':
    socketio.run(app,
                debug=True,
                host='127.0.0.1',
                port=5000,
                allow_unsafe_werkzeug=True) 