import os
import secrets
import time
from urllib.parse import urlencode
import requests
from flask import Blueprint, current_app, jsonify, redirect, request, session
from ..services.firebase import save_user

auth = Blueprint("auth", __name__)

@auth.get("/kakao/login")
def login():
    key = os.getenv("KAKAO_REST_API_KEY")
    uri = os.getenv("KAKAO_REDIRECT_URI")
    if not key or not uri:
        return jsonify(error="kakao_not_configured"), 503
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_started"] = time.time()
    return redirect("https://kauth.kakao.com/oauth/authorize?" + urlencode({
        "client_id": key, "redirect_uri": uri, "response_type": "code", "state": state,
    }))

@auth.get("/kakao/callback")
def callback():
    expected = session.pop("oauth_state", None)
    started = session.pop("oauth_started", 0)
    state = request.args.get("state", "")
    if not expected or not secrets.compare_digest(expected, state) or time.time() - started > 600:
        return jsonify(error="invalid_oauth_state"), 400
    if request.args.get("error") or not request.args.get("code"):
        return jsonify(error="kakao_login_cancelled"), 400
    payload = {
        "grant_type": "authorization_code", "client_id": os.environ["KAKAO_REST_API_KEY"],
        "redirect_uri": os.environ["KAKAO_REDIRECT_URI"], "code": request.args["code"],
    }
    if os.getenv("KAKAO_CLIENT_SECRET"):
        payload["client_secret"] = os.environ["KAKAO_CLIENT_SECRET"]
    token_response = requests.post("https://kauth.kakao.com/oauth/token", data=payload, timeout=10)
    token_response.raise_for_status()
    profile_response = requests.get("https://kapi.kakao.com/v2/user/me", headers={
        "Authorization": f"Bearer {token_response.json()['access_token']}"
    }, timeout=10)
    profile_response.raise_for_status()
    profile = profile_response.json()
    user = {"id": f"kakao:{profile['id']}", "name": profile.get("properties", {}).get("nickname", "Learner")}
    save_user(user)
    session.clear()
    session.permanent = True
    session["user"] = user
    return redirect(current_app.config["FRONTEND_URL"])

@auth.get("/me")
def me():
    if "user" not in session:
        return jsonify(error="unauthenticated"), 401
    return jsonify(session["user"])

@auth.post("/logout")
def logout():
    session.clear()
    return "", 204
