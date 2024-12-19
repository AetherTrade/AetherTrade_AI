from cryptography.fernet import Fernet
from flask import current_app
import os
import json
from datetime import datetime
import logging
from ..models import User
from .. import db

class ApiKeyManager:
    def __init__(self):
        # Get encryption key from environment or generate a new one
        self.encryption_key = os.getenv('ENCRYPTION_KEY')
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key()
            os.environ['ENCRYPTION_KEY'] = self.encryption_key.decode()
        
        self.cipher_suite = Fernet(self.encryption_key if isinstance(self.encryption_key, bytes) 
                                 else self.encryption_key.encode())
        
        # Set up logging
        self.logger = logging.getLogger(__name__)

    def encrypt_api_key(self, api_key: str, user_id: int) -> dict:
        """
        Encrypt API key and store metadata
        """
        try:
            # Create metadata
            metadata = {
                'created_at': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'key_type': 'deriv_api',
                'is_active': True
            }
            
            # Encrypt API key
            encrypted_key = self.cipher_suite.encrypt(api_key.encode())
            
            # Store metadata with encrypted key
            key_data = {
                'encrypted_key': encrypted_key.decode(),
                'metadata': metadata
            }
            
            return key_data

        except Exception as e:
            self.logger.error(f"Error encrypting API key: {str(e)}")
            raise

    def decrypt_api_key(self, encrypted_data: dict) -> str:
        """
        Decrypt API key and validate metadata
        """
        try:
            encrypted_key = encrypted_data['encrypted_key'].encode()
            decrypted_key = self.cipher_suite.decrypt(encrypted_key).decode()
            return decrypted_key
        except Exception as e:
            self.logger.error(f"Error decrypting API key: {str(e)}")
            raise

    def store_api_key(self, user_id: int, api_key: str, account_type: str = 'demo') -> bool:
        """
        Store encrypted API key in database
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise ValueError("User not found")

            # Encrypt API key with metadata
            encrypted_data = self.encrypt_api_key(api_key, user_id)
            
            # Store in database
            user.deriv_api_key = json.dumps(encrypted_data)
            user.api_account_type = account_type
            user.api_key_updated_at = datetime.utcnow()
            
            db.session.commit()
            
            self.logger.info(f"API key stored successfully for user {user_id}")
            return True

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error storing API key: {str(e)}")
            raise

    def get_api_key(self, user_id: int) -> str:
        """
        Retrieve and decrypt API key
        """
        try:
            user = User.query.get(user_id)
            if not user or not user.deriv_api_key:
                raise ValueError("API key not found")

            encrypted_data = json.loads(user.deriv_api_key)
            return self.decrypt_api_key(encrypted_data)

        except Exception as e:
            self.logger.error(f"Error retrieving API key: {str(e)}")
            raise

    def validate_api_key(self, api_key: str) -> bool:
        """
        Basic validation of API key format
        """
        # Add your validation logic here
        return bool(api_key and len(api_key) >= 8)

    def revoke_api_key(self, user_id: int) -> bool:
        """
        Revoke API key access
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise ValueError("User not found")

            user.deriv_api_key = None
            user.api_account_type = None
            user.api_key_updated_at = datetime.utcnow()
            
            db.session.commit()
            
            self.logger.info(f"API key revoked for user {user_id}")
            return True

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error revoking API key: {str(e)}")
            raise