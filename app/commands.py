import click
from flask.cli import with_appcontext
from app.models import User
from app import db

@click.command('list-admins')
@with_appcontext
def list_admins_command():
    """List all admin users"""
    try:
        admins = User.query.filter_by(is_admin=True).all()
        if admins:
            click.echo("\nAdmin Users:")
            for admin in admins:
                click.echo(f"Username: {admin.username}")
                click.echo(f"Email: {admin.email}")
                click.echo(f"Created: {admin.created_at}")
                click.echo("-" * 30)
        else:
            click.echo("No admin users found.")
    except Exception as e:
        click.echo(f"Error listing admins: {str(e)}")

@click.command('create-admin')
@click.argument('username')
@click.argument('email')
@click.argument('password')
@with_appcontext
def create_admin_command(username, email, password):
    """Create an admin user"""
    try:
        admin = User.create_admin(username, email, password)
        click.echo(f'Admin user {username} created successfully!')
    except Exception as e:
        click.echo(f'Error creating admin user: {str(e)}')

def init_app(app):
    app.cli.add_command(list_admins_command)
    app.cli.add_command(create_admin_command) 