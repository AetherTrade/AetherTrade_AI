import click
from flask.cli import with_appcontext
from app.extensions import db
from app.models.user import User
from werkzeug.security import generate_password_hash
from sqlalchemy.sql import text

@click.command('create-admin')
@click.option('--username', prompt=True, help='The admin username')
@click.option('--email', prompt=True, help='The admin email')
@click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True, help='The admin password')
@with_appcontext
def create_admin(username, email, password):
    """Create a new admin user."""
    try:
        admin = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            is_admin=True
        )
        db.session.add(admin)
        db.session.commit()
        click.echo(f'Successfully created admin user: {username}')
    except Exception as e:
        click.echo(f'Error creating admin user: {str(e)}')
        db.session.rollback() 

@click.command('add-api-column')
@with_appcontext
def add_api_column():
    """Add is_api_approved column to user table."""
    try:
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE user ADD COLUMN is_api_approved BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        click.echo('Successfully added is_api_approved column')
    except Exception as e:
        click.echo(f'Error: {str(e)}')

@click.command('approve-admin-api')
@with_appcontext
def approve_admin_api():
    """Approve API access for admin users."""
    try:
        with db.engine.connect() as conn:
            conn.execute(text("UPDATE user SET is_api_approved = 1 WHERE is_admin = 1"))
            conn.commit()
        click.echo('Successfully approved API access for admin users')
    except Exception as e:
        click.echo(f'Error: {str(e)}')

def init_app(app):
    app.cli.add_command(create_admin)
    app.cli.add_command(add_api_column)
    app.cli.add_command(approve_admin_api) 