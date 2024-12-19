from flask import current_app, render_template
from flask_mail import Message
from app import mail
from threading import Thread
import smtplib
import ssl

def test_email_connection():
    """Test the email connection and configuration"""
    try:
        with smtplib.SMTP(current_app.config['MAIL_SERVER'], current_app.config['MAIL_PORT']) as server:
            server.ehlo()
            if current_app.config['MAIL_USE_TLS']:
                server.starttls(context=ssl.create_default_context())
            server.ehlo()
            server.login(current_app.config['MAIL_USERNAME'], current_app.config['MAIL_PASSWORD'])
            current_app.logger.info("Email connection test successful!")
            return True
    except smtplib.SMTPAuthenticationError as e:
        current_app.logger.error(f"SMTP Authentication Error: {str(e)}")
        current_app.logger.error(f"Username being used: {current_app.config['MAIL_USERNAME']}")
        current_app.logger.error("Please verify your Gmail App Password")
        return False
    except Exception as e:
        current_app.logger.error(f"Email connection test failed: {str(e)}")
        return False

def send_async_email(app, msg):
    with app.app_context():
        try:
            # Test connection before sending
            if not test_email_connection():
                raise Exception("Email connection test failed")
            
            mail.send(msg)
            app.logger.info(f"Email sent successfully to {msg.recipients}")
        except Exception as e:
            app.logger.error(f"Failed to send email: {str(e)}")
            raise

def send_email(subject, sender, recipients, text_body, html_body):
    try:
        msg = Message(subject, sender=sender, recipients=recipients)
        msg.body = text_body
        msg.html = html_body
        
        if current_app.config['TESTING']:
            return
            
        # Log email configuration
        current_app.logger.info(f"Attempting to send email using: {current_app.config['MAIL_USERNAME']}")
        
        Thread(
            target=send_async_email,
            args=(current_app._get_current_object(), msg)
        ).start()
        
    except Exception as e:
        current_app.logger.error(f"Error preparing email: {str(e)}")
        raise

def send_password_reset_email(user, token):
    try:
        send_email(
            '[AetherTrade AI] Reset Your Password',
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            recipients=[user.email],
            text_body=render_template('email/reset_password.txt',
                                   user=user, token=token),
            html_body=render_template('email/reset_password.html',
                                   user=user, token=token)
        )
    except Exception as e:
        current_app.logger.error(f"Failed to send password reset email: {str(e)}")
        raise 