import asyncio
import json
from flask_login import current_user
from flask_socketio import SocketIO, emit, join_room, leave_room

socketio = SocketIO()

# Store active connections
user_connections = {}
admin_connections = {}

@socketio.on('connect', namespace='/ws/chat')
def handle_user_connect():
    if not current_user.is_authenticated:
        return False
    
    user_connections[current_user.id] = request.sid
    join_room(f'user_{current_user.id}')
    
    # Notify admins of new user connection
    emit('user_connected', {
        'userId': current_user.id,
        'userInfo': {
            'username': current_user.username,
            'email': current_user.email
        }
    }, namespace='/ws/admin/chat')

@socketio.on('disconnect', namespace='/ws/chat')
def handle_user_disconnect():
    if current_user.is_authenticated:
        user_connections.pop(current_user.id, None)
        leave_room(f'user_{current_user.id}')
        
        # Notify admins of user disconnection
        emit('user_disconnected', {
            'userId': current_user.id
        }, namespace='/ws/admin/chat')

@socketio.on('message', namespace='/ws/chat')
def handle_user_message(data):
    if not current_user.is_authenticated:
        return
    
    message_data = {
        'type': 'message',
        'userId': current_user.id,
        'username': current_user.username,
        'content': data['content'],
        'timestamp': data['timestamp']
    }
    
    # Send to all admin connections
    emit('message', message_data, namespace='/ws/admin/chat')

@socketio.on('admin_message', namespace='/ws/admin/chat')
def handle_admin_message(data):
    if not current_user.is_authenticated or not current_user.is_admin:
        return
    
    user_id = data['userId']
    if user_id in user_connections:
        emit('message', {
            'type': 'message',
            'content': data['content'],
            'sender': 'admin',
            'timestamp': data['timestamp']
        }, room=f'user_{user_id}', namespace='/ws/chat') 