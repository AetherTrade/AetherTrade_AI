from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
from app.models.user import User
from app import db
from app.decorators import admin_required
from werkzeug.security import generate_password_hash
import secrets
import string
from app.email import send_password_reset_email  # Make sure this import exists
import logging
from datetime import datetime
from app.models.tick_data import TickData
from app.constants import AVAILABLE_MARKETS

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(user_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # Always generate a temporary password as fallback
        temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        user.password_hash = generate_password_hash(temp_password)
        user.must_change_password = True

        try:
            db.session.commit()
            
            # Try to send email if requested
            send_email = data.get('sendEmail', True)
            if send_email:
                try:
                    token = user.get_reset_password_token()
                    send_password_reset_email(user, token)
                    return jsonify({
                        'message': 'Password reset email sent successfully',
                        'email': user.email,
                        'tempPassword': temp_password  # Include both for safety
                    }), 200
                except Exception as e:
                    current_app.logger.error(f"Error sending email: {str(e)}")
                    # Fall back to temporary password if email fails
                    return jsonify({
                        'message': 'Email sending failed. Using temporary password instead.',
                        'tempPassword': temp_password
                    }), 200
            else:
                return jsonify({
                    'message': 'Password reset successfully',
                    'tempPassword': temp_password
                }), 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Database error: {str(e)}")
            return jsonify({'error': 'Failed to reset password'}), 500

    except Exception as e:
        current_app.logger.error(f"Error in reset_user_password: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<int:user_id>/suspend', methods=['POST'])
@admin_required
def suspend_user(user_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        user = User.query.get_or_404(user_id)

        # Prevent self-suspension
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot suspend your own account'}), 400

        # Toggle suspension status
        user.is_suspended = not user.is_suspended
        status = 'suspended' if user.is_suspended else 'reactivated'

        try:
            db.session.commit()
            return jsonify({
                'message': f'User successfully {status}',
                'status': status,
                'userId': user.id
            }), 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Database error while suspending user: {str(e)}")
            return jsonify({'error': 'Failed to update user status'}), 500

    except Exception as e:
        current_app.logger.error(f"Error in suspend_user: {str(e)}")
        return jsonify({'error': 'Failed to suspend user'}), 500

@api_bp.route('/users/<int:user_id>/delete', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    try:
        user = User.query.get_or_404(user_id)
        
        # Prevent self-deletion
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
            
        # Prevent deletion of other admins
        if user.is_admin and user.id != current_user.id:
            return jsonify({'error': 'Cannot delete other admin accounts'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User deleted successfully',
            'userId': user_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting user: {str(e)}")
        return jsonify({'error': 'Failed to delete user'}), 500

@api_bp.route('/users/<int:user_id>/toggle_api_approval', methods=['POST'])
@login_required
@admin_required
def toggle_api_approval(user_id):
    try:
        data = request.get_json()
        action = data.get('action')
        
        user = User.query.get_or_404(user_id)
        
        if action == 'approve':
            user.is_api_approved = True
            message = f"API access approved for {user.username}"
            current_app.logger.info(f"Admin {current_user.username} approved API access for {user.username}")
        elif action == 'revoke':
            user.is_api_approved = False
            # Also clear their API key when revoking access
            user.deriv_api_key = None
            message = f"API access revoked for {user.username}"
            current_app.logger.info(f"Admin {current_user.username} revoked API access for {user.username}")
        else:
            return jsonify({'error': 'Invalid action'}), 400
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message,
            'is_approved': user.is_api_approved,
            'has_api_key': bool(user.deriv_api_key)
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in toggle_api_approval: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<int:user_id>/check_api_status', methods=['GET'])
@login_required
def check_api_status(user_id):
    try:
        user = User.query.get_or_404(user_id)
        return jsonify({
            'success': True,
            'is_approved': user.is_api_approved,
            'has_api_key': bool(user.deriv_api_key)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/ticks/sync', methods=['POST'])
@login_required
def sync_ticks():
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
            
        data = request.get_json()
        
        # Validate required fields
        if 'markets' not in data:
            return jsonify({'error': 'Missing markets parameter'}), 400
            
        markets = data.get('markets', [])
        last_sync = data.get('lastSync', 0)
        
        # Convert timestamp to datetime
        last_sync_dt = datetime.fromtimestamp(last_sync/1000.0)
        
        # Get ticks from database
        ticks = TickData.query\
            .filter(TickData.market.in_(markets))\
            .filter(TickData.timestamp > last_sync_dt)\
            .order_by(TickData.timestamp)\
            .limit(1000)\
            .all()
            
        return jsonify({
            'success': True,
            'ticks': [{
                'market': tick.market,
                'price': float(tick.price),
                'timestamp': int(tick.timestamp.timestamp() * 1000)
            } for tick in ticks]
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in sync_ticks: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@api_bp.route('/backup/status')
@login_required
@admin_required
def backup_status():
    return jsonify({
        'last_restore_attempt': getattr(current_app, 'last_restore_time', None),
        'backup_enabled': bool(current_app.backup_manager and current_app.backup_manager.repo),
        'github_connected': bool(current_app.backup_manager and current_app.backup_manager.repo)
    })

# Add other API endpoints here (promote, suspend, delete, etc.) 