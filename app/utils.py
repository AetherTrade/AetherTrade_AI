from flask_wtf.csrf import generate_csrf

def inject_csrf_token():
    return dict(csrf_token=generate_csrf) 