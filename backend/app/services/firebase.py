import os
import firebase_admin
from firebase_admin import firestore


def get_db():
    # Uses Application Default Credentials. Initialize lazily so health works without Firebase.
    try:
        app = firebase_admin.get_app()
    except ValueError:
        app = firebase_admin.initialize_app(options={"projectId": os.environ["FIREBASE_PROJECT_ID"]})
    return firestore.client(app=app)


def save_user(user):
    get_db().collection("users").document(user["id"]).set({
        **user, "last_login_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)
