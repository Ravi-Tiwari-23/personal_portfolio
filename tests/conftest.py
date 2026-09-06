import pytest
from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import Project, User
from config import TestConfig


@pytest.fixture()
def app(tmp_path):
    class LocalTestConfig(TestConfig):
        UPLOAD_FOLDER = tmp_path / "uploads"
        RESUME_FOLDER = tmp_path / "resume"

    application = create_app(LocalTestConfig)
    with application.app_context():
        db.create_all()
        db.session.add(User(username="ravi", email="ravi@example.com", password_hash=generate_password_hash("correct-horse-battery-staple")))
        db.session.add(Project(title="Published Work", slug="published-work", short_description="A public project.", description="Overview", category="Web Development", year="2026", role="Developer", published=True, featured=True, display_order=1))
        db.session.add(Project(title="Private Draft", slug="private-draft", short_description="A draft project.", description="Overview", category="Data", year="2026", role="Developer", published=False, featured=False, display_order=2))
        db.session.commit()
    yield application
    with application.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth(client):
    class AuthActions:
        def login(self):
            return client.post("/admin/login", data={"identity": "ravi", "password": "correct-horse-battery-staple"}, follow_redirects=True)

        def logout(self):
            return client.post("/admin/logout", follow_redirects=True)

    return AuthActions()

