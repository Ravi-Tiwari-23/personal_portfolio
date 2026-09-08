"""Isolated, disposable admin browser-QA server; never opens the user's database."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from app.extensions import db
from app.models import User
from app.skill_catalog import seed_skills_once
from config import TestConfig
from werkzeug.security import generate_password_hash


class BrowserConfig(TestConfig):
    WTF_CSRF_ENABLED = True
    SERVER_NAME = None
    UPLOAD_FOLDER = Path("pytest-tmp-skills-browser-server/uploads").resolve()
    RESUME_FOLDER = Path("pytest-tmp-skills-browser-server/resume").resolve()


app = create_app(BrowserConfig)
with app.app_context():
    db.create_all()
    seed_skills_once()
    db.session.add(User(username="skills-test", email="skills-test@example.com", password_hash=generate_password_hash("skills-preview-test-only")))
    db.session.commit()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, use_reloader=False)
