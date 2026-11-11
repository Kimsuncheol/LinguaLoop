import os
from google.oauth2 import service_account
from googleapiclient.discovery import build


def get_drive_client():
    """Read-only shared resources; personal Drive access requires separate user OAuth."""
    credentials = service_account.Credentials.from_service_account_file(
        os.environ["GOOGLE_DRIVE_CREDENTIALS"],
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)
