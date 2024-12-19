from flask import Blueprint, jsonify, current_app
from flask_login import login_required, current_user
from app.decorators import admin_required
from app.backup.github_backup import GitHubBackupManager
from app.models.user_activity import UserActivity

backup_bp = Blueprint('backup', __name__)

@backup_bp.route('/api/backup/manual', methods=['POST'])
@login_required
@admin_required
def trigger_manual_backup():
    """Trigger manual backup to GitHub"""
    try:
        backup_manager = GitHubBackupManager(
            current_app.config['GITHUB_TOKEN'],
            current_app.config['GITHUB_BACKUP_REPO']
        )
        
        users_success = backup_manager.backup_users()
        ticks_success = backup_manager.backup_ticks()
        
        # Log the backup activity
        UserActivity.log_activity(
            user_id=current_user.id,
            activity_type='backup',
            description='Manual backup triggered',
            status='success' if (users_success and ticks_success) else 'partial',
            details={
                'users_backup': users_success,
                'ticks_backup': ticks_success
            }
        )
        
        return jsonify({
            'success': users_success and ticks_success,
            'message': 'Backup completed successfully'
        })
    except Exception as e:
        UserActivity.log_activity(
            user_id=current_user.id,
            activity_type='backup',
            description='Manual backup failed',
            status='failed',
            details={'error': str(e)}
        )
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@backup_bp.route('/api/backup/restore', methods=['POST'])
@login_required
@admin_required
def restore_from_backup():
    """Restore data from GitHub backup"""
    try:
        backup_manager = GitHubBackupManager(
            current_app.config['GITHUB_TOKEN'],
            current_app.config['GITHUB_BACKUP_REPO']
        )
        
        users_success = backup_manager.restore_users()
        ticks_success = backup_manager.restore_ticks()
        
        UserActivity.log_activity(
            user_id=current_user.id,
            activity_type='restore',
            description='Manual restore triggered',
            status='success' if (users_success and ticks_success) else 'partial',
            details={
                'users_restore': users_success,
                'ticks_restore': ticks_success
            }
        )
        
        return jsonify({
            'success': users_success and ticks_success,
            'message': 'Restore completed successfully'
        })
    except Exception as e:
        UserActivity.log_activity(
            user_id=current_user.id,
            activity_type='restore',
            description='Manual restore failed',
            status='failed',
            details={'error': str(e)}
        )
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@backup_bp.route('/api/backup/status', methods=['GET'])
@login_required
@admin_required
def get_backup_status():
    """Get backup system status"""
    try:
        backup_manager = GitHubBackupManager(
            current_app.config['GITHUB_TOKEN'],
            current_app.config['GITHUB_BACKUP_REPO']
        )
        
        latest_users = backup_manager.repo.get_contents("latest_users.json")
        latest_ticks = backup_manager.repo.get_contents("latest_ticks.csv")
        
        return jsonify({
            'success': True,
            'users_backup': {
                'last_updated': latest_users.last_modified,
                'size': latest_users.size
            },
            'ticks_backup': {
                'last_updated': latest_ticks.last_modified,
                'size': latest_ticks.size
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500