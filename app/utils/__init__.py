# This can be empty, it just marks the directory as a Python package

from flask import session
from flask_wtf.csrf import generate_csrf

def inject_csrf_token():
    """
    Inject CSRF token into template context.
    This allows us to include CSRF protection in forms and AJAX requests.
    """
    return dict(csrf_token=generate_csrf())

# Export the ApiKeyManager for convenience
from .api_key_manager import ApiKeyManager