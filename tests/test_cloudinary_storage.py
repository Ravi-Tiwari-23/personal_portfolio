import io
import sys
from datetime import date
from types import ModuleType

from PIL import Image

from app.extensions import db
from app.media_storage import image_url, responsive_image_url
from app.models import Certificate, Project


def png_upload(name="image.png"):
    stream = io.BytesIO()
    Image.new("RGB", (40, 30), "coral").save(stream, format="PNG")
    stream.seek(0)
    return stream, name


def install_fake_cloudinary(monkeypatch, calls):
    package = ModuleType("cloudinary")
    uploader = ModuleType("cloudinary.uploader")
    package.__path__ = []
    package.config = lambda **kwargs: calls.append(("config", kwargs))

    def upload(file_object, **kwargs):
        calls.append(("upload", kwargs, file_object.read()))
        return {
            "secure_url": "https://res.cloudinary.com/demo/image/upload/ravi-portfolio/certificates/asset.png",
            "public_id": "ravi-portfolio/certificates/asset",
        }

    uploader.upload = upload
    uploader.destroy = lambda public_id, **kwargs: calls.append(("destroy", public_id, kwargs))
    package.uploader = uploader
    monkeypatch.setitem(sys.modules, "cloudinary", package)
    monkeypatch.setitem(sys.modules, "cloudinary.uploader", uploader)


def test_cloudinary_certificate_upload_stores_secure_url_and_public_id(app, client, auth, monkeypatch):
    calls = []
    install_fake_cloudinary(monkeypatch, calls)
    app.config.update(
        CLOUDINARY_CLOUD_NAME="demo",
        CLOUDINARY_API_KEY="test-key",
        CLOUDINARY_API_SECRET="test-secret",
    )
    auth.login()
    response = client.post(
        "/admin/certificates/new",
        data={
            "title": "Cloud Credential",
            "issuer": "Cloud Academy",
            "description": "",
            "credential_id": "",
            "credential_url": "",
            "issued_date": "2026-09-01",
            "expiry_date": "",
            "display_order": "1",
            "is_active": "y",
            "image": png_upload(),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Certificate added" in response.data
    with app.app_context():
        certificate = Certificate.query.one()
        assert certificate.image_url.startswith("https://res.cloudinary.com/")
        assert certificate.image_public_id == "ravi-portfolio/certificates/asset"
    upload_call = next(call for call in calls if call[0] == "upload")
    assert upload_call[1]["folder"] == "ravi-portfolio/certificates"
    assert b"test-secret" not in client.get("/").data
    homepage = client.get("/").data
    assert b"/image/upload/f_auto,q_auto,c_limit,w_960/ravi-portfolio/certificates/asset.png" in homepage
    assert b"/image/upload/f_auto,q_auto,c_limit,w_480/ravi-portfolio/certificates/asset.png 480w" in homepage


def test_certificate_replacement_uploads_before_destroying_old_asset(app, client, auth, monkeypatch):
    calls = []
    install_fake_cloudinary(monkeypatch, calls)
    app.config.update(
        CLOUDINARY_CLOUD_NAME="demo",
        CLOUDINARY_API_KEY="test-key",
        CLOUDINARY_API_SECRET="test-secret",
    )
    with app.app_context():
        certificate = Certificate(
            title="Existing Certificate",
            issuer="Existing Issuer",
            issued_date=date(2025, 1, 1),
            image_url="https://res.cloudinary.com/demo/image/upload/ravi-portfolio/certificates/old.png",
            image_public_id="ravi-portfolio/certificates/old",
            is_active=True,
        )
        db.session.add(certificate)
        db.session.commit()
        certificate_id = certificate.id

    auth.login()
    response = client.post(
        f"/admin/certificates/{certificate_id}/edit",
        data={
            "title": "Existing Certificate",
            "issuer": "Existing Issuer",
            "description": "Updated description",
            "credential_id": "NEW-ID",
            "credential_url": "https://credentials.example.com/new",
            "issued_date": "2025-01-01",
            "expiry_date": "",
            "display_order": "4",
            "is_featured": "y",
            "is_active": "y",
            "image": png_upload("replacement.png"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Certificate updated" in response.data
    event_names = [call[0] for call in calls]
    assert event_names.index("upload") < event_names.index("destroy")
    assert next(call for call in calls if call[0] == "upload")[1]["folder"] == "ravi-portfolio/certificates"
    assert next(call for call in calls if call[0] == "destroy")[1] == "ravi-portfolio/certificates/old"
    with app.app_context():
        updated = db.session.get(Certificate, certificate_id)
        assert updated.image_url.endswith("/ravi-portfolio/certificates/asset.png")
        assert updated.is_featured is True


def test_project_cloudinary_thumbnail_and_legacy_image_references(app, client, auth, monkeypatch):
    calls = []
    install_fake_cloudinary(monkeypatch, calls)
    app.config.update(
        CLOUDINARY_CLOUD_NAME="demo",
        CLOUDINARY_API_KEY="test-key",
        CLOUDINARY_API_SECRET="test-secret",
    )
    auth.login()
    with app.app_context():
        project = Project.query.filter_by(slug="published-work").one()
        project_id = project.id
    response = client.post(
        f"/admin/projects/{project_id}/edit",
        data={
            "title": "Published Work",
            "slug": "published-work",
            "short_description": "A public project.",
            "description": "Overview",
            "category": "Web Development",
            "year": "2026",
            "role": "Developer",
            "technologies": "",
            "display_order": "1",
            "published": "y",
            "featured": "y",
            "thumbnail": png_upload("project.png"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Project updated" in response.data
    with app.app_context():
        assert db.session.get(Project, project_id).thumbnail.startswith("https://res.cloudinary.com/")
        with app.test_request_context():
            assert image_url("https://example.com/a.png") == "https://example.com/a.png"
            assert image_url("static:images/favicon.svg").endswith("/static/images/favicon.svg")
            assert image_url("uploads/local.png").endswith("/media/local.png")
            assert responsive_image_url("https://example.com/a.png", 800) == "https://example.com/a.png"
            assert "/image/upload/f_auto,q_auto,c_limit,w_800/" in responsive_image_url(
                "https://res.cloudinary.com/demo/image/upload/asset.png", 800
            )
    assert any(call[0] == "upload" and call[1]["folder"] == "portfolio/projects" for call in calls)
    for path in ("/", "/projects", "/projects/published-work"):
        assert b"https://res.cloudinary.com/" in client.get(path).data


def test_csp_allows_only_the_cloudinary_image_origin(client):
    policy = client.get("/").headers["Content-Security-Policy"]
    assert "img-src 'self' data: https://res.cloudinary.com" in policy
    assert "script-src 'self'" in policy
