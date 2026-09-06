import io
import re

from app.models import Project, SiteSetting


def test_csrf_protected_login_page_accepts_a_valid_token(app):
    app.config["WTF_CSRF_ENABLED"] = True
    client = app.test_client()
    page = client.get("/admin/login")
    token = re.search(rb'name="csrf_token"[^>]*value="([^"]+)"', page.data).group(1).decode()
    response = client.post(
        "/admin/login",
        data={"csrf_token": token, "identity": "ravi", "password": "correct-horse-battery-staple"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/admin")


def test_admin_requires_login(client):
    response = client.get("/admin", follow_redirects=False)
    assert response.status_code == 302
    assert "/admin/login" in response.headers["Location"]


def test_login_rejects_invalid_and_accepts_valid(client, auth):
    invalid = client.post("/admin/login", data={"identity": "ravi", "password": "wrong"}, follow_redirects=True)
    assert b"incorrect" in invalid.data
    valid = auth.login()
    assert b"Welcome back" in valid.data


def test_project_create_edit_publish_delete(app, client, auth):
    auth.login()
    create = client.post("/admin/projects/new", data={"title": "New System", "slug": "", "short_description": "A strong new case study.", "description": "Complete overview", "category": "Automation", "year": "2026", "role": "Lead", "technologies": "Python, Flask", "display_order": "5", "published": "y"}, follow_redirects=True)
    assert create.status_code == 200
    assert b"Project created" in create.data
    with app.app_context():
        project = Project.query.filter_by(slug="new-system").one()
        project_id = project.id
        assert project.published is True
        assert {t.name for t in project.technologies} == {"Python", "Flask"}

    edit = client.post(f"/admin/projects/{project_id}/edit", data={"title": "New System Updated", "slug": "new-system", "short_description": "Updated case study.", "description": "Complete overview", "category": "Automation", "year": "2026", "role": "Lead", "technologies": "Python", "display_order": "5"}, follow_redirects=True)
    assert b"Project updated" in edit.data
    assert client.get("/projects/new-system").status_code == 404

    delete = client.post(f"/admin/projects/{project_id}/delete", follow_redirects=True)
    assert b"Project deleted" in delete.data


def test_resume_rejects_non_pdf_and_accepts_pdf(app, client, auth):
    auth.login()
    invalid = client.post("/admin/resume", data={"resume": (io.BytesIO(b"not a pdf"), "resume.pdf")}, content_type="multipart/form-data", follow_redirects=True)
    assert b"not a valid PDF" in invalid.data
    valid = client.post("/admin/resume", data={"resume": (io.BytesIO(b"%PDF-1.4\n% test"), "resume.pdf")}, content_type="multipart/form-data", follow_redirects=True)
    assert b"updated successfully" in valid.data
    download = client.get("/resume/download")
    assert download.status_code == 200
    assert "Ravi_Kumar_Tiwari_Resume.pdf" in download.headers["Content-Disposition"]
    with app.app_context():
        assert SiteSetting.get("resume_path").endswith(".pdf")
