# Test your .env setup
import os
from dotenv import load_dotenv

# Load the environment variables
load_dotenv()

# Try to get the values
token = os.getenv('GITHUB_TOKEN')
repo = os.getenv('GITHUB_BACKUP_REPO')

# Print results
print(f"Token exists: {'Yes' if token else 'No'}")
print(f"Token value: {token[:10]}..." if token else "No token found")
print(f"Repo name: {repo}")