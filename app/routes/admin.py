from flask import Blueprint, render_template, redirect, url_for, flash, jsonify, request, current_app
from flask_login import login_required, current_user
from functools import wraps
from .. import db
from ..models import User
from werkzeug.security import generate_password_hash
import secrets
import string
from datetime import datetime
from flask_wtf.csrf import generate_csrf
from app.email import send_password_reset_email  # Import the email function
from time import time
import jwt
from app.backup.user_history import UserHistoryViewer
from app.backup.backup_stats import BackupStats
from app.backup.user_restore import UserRestoreManager

admin_bp = Blueprint('admin', __name__)

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('You do not have permission to access this page.', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
@login_required
@admin_required
def admin_dashboard():
    users = User.query.all()
    return render_template('dashboard/admin.html', users=users)

@admin_bp.route('/users')
@login_required
@admin_required
def manage_users():
    users = User.query.all()
    return render_template('dashboard/admin/users.html', users=users)

@admin_bp.route('/system')
@login_required
@admin_required
def system_status():
    return render_template('dashboard/admin/system.html')

@admin_bp.route('/logs')
@login_required
@admin_required
def activity_logs():
    return render_template('dashboard/admin/logs.html')

@admin_bp.route('/check-admin')
def check_admin():
    # Get the admin user
    admin_user = User.query.filter_by(email='admin@aethertrade.ai').first()
    
    if admin_user:
        return {
            'exists': True,
            'email': admin_user.email,
            'is_admin': admin_user.is_admin,
            'username': admin_user.username
        }
    return {'exists': False} 

# User Management API Endpoints
@admin_bp.route('/api/users/<int:user_id>/edit', methods=['POST'])
@admin_required
def edit_user(user_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        user = User.query.get_or_404(user_id)
        data = request.get_json()

        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        
        if data.get('role') == 'admin':
            user.is_admin = True
        elif data.get('role') == 'user':
            user.is_admin = False

        db.session.commit()

        response = jsonify({'message': 'User updated successfully'})
        response.headers['X-CSRF-Token'] = generate_csrf()
        return response, 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error editing user: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_bp.route('/api/users/<int:user_id>/promote', methods=['POST'])
@admin_required
def promote_user(user_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        user = User.query.get_or_404(user_id)
        
        # Check if user is already an admin
        if user.is_admin:
            return jsonify({'error': 'User is already an admin'}), 400

        # Promote user to admin
        user.is_admin = True
        db.session.commit()

        response = jsonify({
            'message': 'User promoted to admin successfully',
            'newRole': 'Admin'
        })
        return response, 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error promoting user: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_bp.route('/api/users/<int:user_id>/suspend', methods=['POST'])
@admin_required
def suspend_user(user_id):
    try:
        user = User.query.get_or_404(user_id)
        data = request.form

        user.is_suspended = True
        user.suspension_reason = data.get('reason')
        user.suspension_duration = data.get('duration')
        user.suspended_at = datetime.utcnow()

        db.session.commit()
        return jsonify({'message': 'User suspended successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@admin_bp.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(user_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        user = User.query.get_or_404(user_id)
        data = request.get_json()
        send_email = data.get('sendEmail', True)

        if send_email:
            # Generate reset token
            token = user.get_reset_password_token()
            try:
                send_password_reset_email(user, token)
                return jsonify({
                    'message': 'Password reset email sent successfully',
                    'email': user.email
                }), 200
            except Exception as e:
                current_app.logger.error(f"Error sending email: {str(e)}")
                return jsonify({'error': 'Failed to send reset email'}), 500
        else:
            # Generate temporary password
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
            user.password_hash = generate_password_hash(temp_password)
            user.must_change_password = True
            
            try:
                db.session.commit()
                return jsonify({
                    'message': 'Password reset successfully',
                    'tempPassword': temp_password
                }), 200
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error setting temporary password: {str(e)}")
                return jsonify({'error': 'Failed to set temporary password'}), 500

    except Exception as e:
        current_app.logger.error(f"Error in reset_user_password: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@admin_bp.route('/api/users/<int:user_id>/delete', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    try:
        user = User.query.get_or_404(user_id)
        
        # Log deletion
        reason = request.form.get('reason', 'No reason provided')
        # You might want to store this in an audit log
        
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400 

@admin_bp.route('/approve_real_account/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def approve_real_account(user_id):
    user = User.query.get_or_404(user_id)
    action = request.form.get('action')
    
    if action == 'approve':
        user.real_account_approved = True
        user.approval_status = 'approved'
        user.approval_date = datetime.utcnow()
        user.approved_by = current_user.id
        flash(f'Real account access approved for {user.username}', 'success')
    elif action == 'reject':
        user.real_account_approved = False
        user.approval_status = 'rejected'
        flash(f'Real account access rejected for {user.username}', 'warning')
    
    db.session.commit()
    return redirect(url_for('admin.user_management')) 

@admin_bp.route('/api/backup/interval', methods=['POST'])
@login_required
@admin_required
def update_backup_interval():
    data = request.get_json()
    backup_type = data.get('type')
    interval = data.get('interval')
    
    if not backup_type or not interval:
        return jsonify({'success': False, 'message': 'Missing parameters'})
        
    success = current_app.backup_scheduler.update_interval(backup_type, interval)
    
    return jsonify({
        'success': success,
        'message': 'Backup interval updated' if success else 'Failed to update interval'
    })

# GitHub Routes
@admin_bp.route('/api/github/sync', methods=['POST'])
@login_required
@admin_required
def github_sync():
    try:
        # Implement your GitHub sync logic here
        return jsonify({
            'success': True,
            'repository': 'aethertrade-backups',
            'branch': 'main',
            'lastSync': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'Live data streaming'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/github/status')
@login_required
@admin_required
def github_status():
    try:
        # Implement your GitHub status check logic here
        return jsonify({
            'success': True,
            'repository': 'aethertrade-backups',
            'branch': 'main',
            'lastSync': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'CONNECTED'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# Backup Routes
@admin_bp.route('/api/backup/create', methods=['POST'])
@login_required
@admin_required
def create_backup():
    try:
        # Implement your backup creation logic here
        return jsonify({
            'success': True,
            'lastBackup': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'size': '1.2 MB',
            'count': '1'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/backup/restore', methods=['POST'])
@login_required
@admin_required
def restore_backup():
    try:
        # Implement your backup restoration logic here
        return jsonify({
            'success': True,
            'message': 'Backup restored successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/backup/schedule', methods=['POST'])
@login_required
@admin_required
def schedule_backup():
    try:
        data = request.get_json()
        # Implement your backup scheduling logic here
        return jsonify({
            'success': True,
            'frequency': data.get('frequency'),
            'time': data.get('time')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/backup/status')
@login_required
@admin_required
def backup_status():
    try:
        # Implement your backup status check logic here
        return jsonify({
            'success': True,
            'lastBackup': 'Never',
            'size': '0 MB',
            'count': '0'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/backup/logs', methods=['GET'])
@login_required
@admin_required
def get_backup_logs():
    try:
        backup_manager = current_app.backup_scheduler.backup_manager
        logs = backup_manager.get_logs()
        
        return jsonify({
            'success': True,
            'logs': logs
        })
        
    except Exception as e:
        current_app.logger.error(f"Error fetching backup logs: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/backup/logs/clear', methods=['POST'])
@login_required
@admin_required
def clear_backup_logs():
    try:
        backup_manager = current_app.backup_scheduler.backup_manager
        success = backup_manager.clear_logs()
        
        return jsonify({
            'success': success,
            'message': 'Logs cleared successfully' if success else 'Failed to clear logs'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error clearing backup logs: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/user/history/<username>')
@login_required
@admin_required
def get_user_history(username):
    viewer = UserHistoryViewer(current_app.backup_scheduler.backup_manager)
    history = viewer.get_user_history(username)
    return jsonify(history)

@admin_bp.route('/api/backup/stats')
@login_required
@admin_required
def get_backup_stats():
    stats = BackupStats(current_app.backup_scheduler.backup_manager)
    return jsonify(stats.get_backup_stats())

@admin_bp.route('/api/user/restore', methods=['POST'])
@login_required
@admin_required
def restore_user():
    data = request.get_json()
    username = data.get('username')
    backup_sha = data.get('backup_sha')
    
    restore_manager = UserRestoreManager(current_app.backup_scheduler.backup_manager)
    success, message = restore_manager.restore_user_from_backup(username, backup_sha)
    
    return jsonify({
        'success': success,
        'message': message
    })

@admin_bp.route('/backup')
@login_required
@admin_required
def backup_management():
    return render_template('dashboard/admin/backup.html')