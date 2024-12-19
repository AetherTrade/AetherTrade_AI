from flask import Blueprint, jsonify, request, current_app
from flask_login import login_required, current_user
from app.utils.api_key_manager import ApiKeyManager

deriv_api_bp = Blueprint('deriv_api', __name__, url_prefix='/deriv-api')

@deriv_api_bp.route('/get-token')
@login_required
def get_deriv_token():
    """Retrieve the Deriv API token"""
    try:
        api_manager = ApiKeyManager()
        api_key = api_manager.get_api_key(current_user.id)
        return jsonify({
            'success': True,
            'token': api_key
        })
    except Exception as e:
        current_app.logger.error(f"Error retrieving API token: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve API token'
        }), 400

@deriv_api_bp.route('/store-token', methods=['POST'])
@login_required
def store_deriv_token():
    """Store the Deriv API token"""
    try:
        data = request.get_json()
        api_key = data.get('api_key')
        account_type = data.get('account_type', 'demo')

        if not api_key:
            return jsonify({
                'success': False,
                'error': 'API key is required'
            }), 400

        # Validate account type permissions
        if account_type == 'real' and not current_user.is_api_approved:
            return jsonify({
                'success': False,
                'error': 'Real account access requires admin approval'
            }), 403

        # Store the API key
        api_manager = ApiKeyManager()
        api_manager.store_api_key(
            user_id=current_user.id,
            api_key=api_key,
            account_type=account_type
        )

        return jsonify({
            'success': True,
            'message': 'API key stored successfully'
        })

    except Exception as e:
        current_app.logger.error(f"Error storing API token: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to store API key'
        }), 500
