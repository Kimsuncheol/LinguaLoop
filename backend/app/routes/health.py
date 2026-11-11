from flask import Blueprint, jsonify
health = Blueprint("health", __name__)

@health.get("/health")
def check():
    return jsonify(status="ok", service="lingualoop-api")
