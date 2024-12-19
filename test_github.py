from github import Github
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_github_connection():
    try:
        # Initialize Github with your token
        g = Github(os.getenv('GITHUB_TOKEN'))
        
        # Try to access the repository
        repo = g.get_user().get_repo(os.getenv('GITHUB_BACKUP_REPO'))
        
        print("✓ Successfully connected to GitHub!")
        print(f"✓ Repository: {repo.full_name}")
        print(f"✓ Created: {repo.created_at}")
        print(f"✓ URL: {repo.html_url}")
        
        return True
    except Exception as e:
        print(f"✗ Connection error: {str(e)}")
        return False

if __name__ == "__main__":
    test_github_connection()