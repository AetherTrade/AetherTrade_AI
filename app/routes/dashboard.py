from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from functools import wraps

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')

def user_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_admin:
            return redirect(url_for('admin.admin_dashboard'))
        return f(*args, **kwargs)
    return decorated_function

@dashboard_bp.route('/')
@dashboard_bp.route('/home')
@login_required
@user_required
def home():
    return render_template('dashboard/home.html')

@dashboard_bp.route('/user')
@login_required
@user_required
def user():
    return render_template('dashboard/user.html')

@dashboard_bp.route('/profile')
@login_required
@user_required
def profile():
    return render_template('dashboard/profile.html')

@dashboard_bp.route('/trading')
@login_required
@user_required
def trading():
    return render_template('dashboard/trading.html')

@dashboard_bp.route('/history')
@login_required
@user_required
def history():
    return render_template('dashboard/history.html')

@dashboard_bp.route('/analytics')
@login_required
@user_required
def analytics():
    return render_template('dashboard/analytics.html')

@dashboard_bp.route('/settings')
@login_required
@user_required
def settings():
    return render_template('dashboard/settings.html') 