from flask import Blueprint, render_template, redirect, url_for, flash, request, session, current_app, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Message
from datetime import datetime, timedelta
import jwt
from .. import mail, db
from ..models import User, generate_reset_token, verify_reset_token
from itsdangerous import URLSafeTimedSerializer
import os
import logging
from ..forms.auth import ForgotPasswordForm, ResetPasswordForm, LoginForm, RegistrationForm, SetupAPIForm
from functools import wraps
import json
from websocket import create_connection
from ..utils.api_key_manager import ApiKeyManager
from app.backup.github_backup import GitHubBackupManager

# Create the Blueprint and initialize managers
auth = Blueprint('auth', __name__)
serializer = URLSafeTimedSerializer(os.getenv('SECRET_KEY'))
api_manager = ApiKeyManager()

# Test route to verify routing is working
@auth.route('/test')
def test():
    return jsonify({"message": "Auth routes are working!"})

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        if current_user.deriv_api_key:
            return redirect(url_for('dashboard.user'))
        return redirect(url_for('auth.setup_api'))

    form = LoginForm()
    if form.validate_on_submit():
        email = form.email.data
        password = form.password.data
        
        print(f"\nLogin attempt details:")
        print(f"Email: {email}")
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"Found user: {user.username}")
            print(f"Stored hash: {user.password_hash}")
            
            # Test password directly
            direct_test = check_password_hash(user.password_hash, password)
            method_test = user.check_password(password)
            
            print(f"Direct password check: {direct_test}")
            print(f"Method password check: {method_test}")
            
            if user.check_password(password):
                print("Login successful!")
                login_user(user, remember=form.remember_me.data)
                
                # Check role and redirect accordingly
                if user.is_admin:
                    print("Admin user - redirecting to admin dashboard")
                    return redirect(url_for('admin.admin_dashboard'))
                elif user.deriv_api_key:
                    print("Regular user with API key - redirecting to user dashboard")
                    return redirect(url_for('dashboard.user'))
                else:
                    print("User needs API setup - redirecting to setup")
                    return redirect(url_for('auth.setup_api'))
            else:
                print("Password check failed")
        else:
            print("No user found with this email")

        flash('Invalid email or password', 'error')
    return render_template('auth/login.html', form=form)

@auth.route('/register', methods=['GET', 'POST'])
def register():
    # Clear any existing sessions to prevent unwanted redirects
    session.clear()
    
    # Force redirect to login if already authenticated
    if current_user.is_authenticated:
        logout_user()
        return redirect(url_for('auth.login'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        try:
            # Check if user already exists
            if User.query.filter_by(email=form.email.data).first():
                flash('Email already registered. Please login.', 'error')
                return redirect(url_for('auth.login'))
            
            if User.query.filter_by(username=form.username.data).first():
                flash('Username already taken. Please choose another.', 'error')
                return render_template('auth/register.html', form=form)
            
            # Create new user
            user = User(
                username=form.username.data,
                email=form.email.data
            )
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            
            # Trigger backup after successful registration
            backup_manager = GitHubBackupManager(
                current_app.config['GITHUB_TOKEN'],
                current_app.config['GITHUB_BACKUP_REPO']
            )
            backup_manager.backup_users()
            current_app.logger.info(f'Backup triggered after new user registration: {user.username}')
            
            # Ensure user is logged out and session is clean
            if current_user.is_authenticated:
                logout_user()
            session.clear()
            
            # Always redirect to login after registration
            flash('Registration successful! Please login to continue.', 'success')
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            db.session.rollback()
            flash('Registration failed. Please try again.', 'error')
            current_app.logger.error(f'Registration error: {str(e)}')
    
    return render_template('auth/register.html', form=form)

@auth.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    form = ForgotPasswordForm()
    if form.validate_on_submit():
        email = form.email.data
        try:
            # Create the email message
            msg = Message('Password Reset Request',
                          sender=current_app.config['MAIL_DEFAULT_SENDER'],
                          recipients=[email])
            msg.body = f'''To reset your password, visit the following link:
{url_for('auth.reset_password', token=generate_reset_token(email), _external=True)}

If you did not make this request, simply ignore this email.
'''
            # Send the email
            mail.send(msg)
            flash('Password reset instructions have been sent to your email.', 'success')
            return redirect(url_for('auth.login'))
        except Exception as e:
            current_app.logger.error(f'Failed to send password reset email: {str(e)}')
            flash('Failed to send password reset email. Please try again later.', 'error')
    
    return render_template('auth/forgot_password.html', form=form)

@auth.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    email = verify_reset_token(token)
    if not email:
        flash('Invalid or expired reset token. Please request a new one.', 'error')
        return redirect(url_for('auth.forgot_password'))

    form = ResetPasswordForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=email).first()
        if user:
            try:
                user.set_password(form.password.data)
                db.session.commit()
                flash('Your password has been successfully reset! Please login with your new password.', 'success')
                return redirect(url_for('auth.login'))
            except Exception as e:
                db.session.rollback()
                flash('An error occurred. Please try again.', 'error')
                current_app.logger.error(f'Password reset error: {str(e)}')
        else:
            flash('User not found.', 'error')
            return redirect(url_for('auth.forgot_password'))
    
    return render_template('auth/reset_password.html', form=form, token=token)

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.index'))

def check_real_account_permission(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login'))
        
        api_key = request.form.get('deriv_api_key')
        account_type = request.form.get('account_type')
        
        if account_type == 'real' and not current_user.real_account_approved:
            flash('Real account access requires admin approval. Please use demo account or contact admin.', 'warning')
            return redirect(url_for('auth.setup_api'))
        return f(*args, **kwargs)
    return decorated_function

@auth.route('/setup-api', methods=['GET', 'POST'])
@login_required
def setup_api():
    form = SetupAPIForm()
    if form.validate_on_submit():
        api_key = form.deriv_api_key.data
        account_type = request.form.get('account_type', 'demo')

        # Server-side validation for real account access
        if account_type == 'real' and not current_user.is_api_approved:
            flash('Unauthorized attempt to use real account detected. This incident has been logged.', 'error')
            current_app.logger.warning(
                f'User {current_user.username} attempted to bypass real account restrictions'
            )
            return redirect(url_for('auth.setup_api'))

        try:
            # Validate API key with Deriv
            is_valid, is_virtual = validate_deriv_api(api_key)
            
            if not is_valid:
                flash('Invalid API key', 'error')
                return redirect(url_for('auth.setup_api'))

            # Double-check account type matches API key type
            if (account_type == 'real' and is_virtual) or (account_type == 'demo' and not is_virtual):
                flash('Account type mismatch detected. This incident has been logged.', 'error')
                current_app.logger.warning(
                    f'User {current_user.username} attempted to submit mismatched account type'
                )
                return redirect(url_for('auth.setup_api'))

            # Store API key using the new manager
            api_manager.store_api_key(
                user_id=current_user.id,
                api_key=api_key,
                account_type=account_type
            )

            # Update user's account type and validation timestamp
            current_user.api_account_type = account_type
            current_user.api_key_updated_at = datetime.utcnow()
            db.session.commit()

            # Log successful API setup
            current_app.logger.info(
                f'User {current_user.username} successfully set up {account_type} API access'
            )
            
            flash('API setup successful!', 'success')
            return redirect(url_for('dashboard.user'))

        except Exception as e:
            current_app.logger.error(f'API setup error for user {current_user.username}: {str(e)}')
            flash('An error occurred during API setup. Please try again.', 'error')
            return redirect(url_for('auth.setup_api'))

    return render_template('auth/setup_api.html', form=form)

def validate_deriv_api(api_key):
    """Validate API key with Deriv websocket API"""
    try:
        # Initialize WebSocket connection
        websocket.enableTrace(True)
        ws = create_connection("wss://ws.binaryws.com/websockets/v3?app_id=1089")
        
        # Send authorization request
        auth_request = {
            "authorize": api_key
        }
        ws.send(json.dumps(auth_request))
        
        # Get response
        response = json.loads(ws.recv())
        ws.close()
        
        if "error" in response:
            return False, None
            
        # Check if account is virtual (demo) or real
        is_virtual = response.get("authorize", {}).get("is_virtual", True)
        
        return True, is_virtual
        
    except Exception as e:
        current_app.logger.error(f'Deriv API validation error: {str(e)}')
        return False, None

@auth.route('/send-test-email')
def send_test_email():
    try:
        # Add debug logging
        current_app.logger.info(f"Attempting to send email from: {current_app.config['MAIL_USERNAME']}")
        
        msg = Message('Test Email from AetherTrade AI',
                      sender='aethertradeai@gmail.com',
                      recipients=['jessemaranga@gmail.com'])
        msg.body = 'This is a test email sent from AetherTrade_AI.'
        mail.send(msg)
        flash('Test email sent successfully!', 'success')
    except Exception as e:
        current_app.logger.error(f'Failed to send test email: {str(e)}')
        flash('Failed to send test email. Please check the logs for more details.', 'error')
    
    return redirect(url_for('main.index')) 

@auth.route('/admin-contact')
def admin_contact():
    return render_template('auth/admin_contact.html')
    