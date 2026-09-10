import io
from datetime import date

from PIL import Image

from app.extensions import db
from app.models import Certificate


def png_upload(name="certificate.png"):
    stream = io.BytesIO()
    Image.new("RGB", (80, 50), "white").save(stream, format="PNG")
    stream.seek(0)
    return stream, name


def certificate_data(**overrides):
    data = {
        "title": "Python Professional Certificate",
        "issuer": "Example Academy",
        "description": "A verified technical credential.",
        "credential_id": "CERT-2026-01",
        "credential_url": "credentials.example.com/cert-2026-01",
        "issued_date": "2026-08-01",
        "expiry_date": "",
        "display_order": "2",
        "is_featured": "y",
        "is_active": "y",
    }
    data.update(overrides)
    return data


def test_admin_certificate_list_create_edit_reorder_toggle_and_delete(app, client, auth):
    auth.login()
    assert client.get("/admin/certificates").status_code == 200

    data = certificate_data(image=png_upload())
    created = client.post("/admin/certificates/new", data=data, content_type="multipart/form-data", follow_redirects=True)
    assert b"Certificate added" in created.data

    with app.app_context():
        certificate = Certificate.query.one()
        certificate_id = certificate.id
        original_image = certificate.image_url
        assert certificate.credential_url == "https://credentials.example.com/cert-2026-01"
        assert certificate.image_url.endswith(".png")
        assert certificate.image_public_id is None
        assert (app.config["UPLOAD_FOLDER"] / certificate.image_url).is_file()

    edited = client.post(
        f"/admin/certificates/{certificate_id}/edit",
        data=certificate_data(title="Updated Python Certificate", display_order="7", is_featured=""),
        follow_redirects=True,
    )
    assert b"Certificate updated" in edited.data
    with app.app_context():
        certificate = db.session.get(Certificate, certificate_id)
        assert certificate.image_url == original_image
        assert certificate.display_order == 7
        assert certificate.is_featured is False

    reordered = client.post(f"/admin/certificates/reorder", data={f"order_{certificate_id}": "1"}, follow_redirects=True)
    assert b"Certificate order saved" in reordered.data

    hidden = client.post(f"/admin/certificates/{certificate_id}/toggle", follow_redirects=True)
    assert b"Certificate visibility updated" in hidden.data
    assert b"Updated Python Certificate" not in client.get("/").data
    client.post(f"/admin/certificates/{certificate_id}/toggle")

    homepage = client.get("/")
    assert b"Updated Python Certificate" in homepage.data
    assert b"https://credentials.example.com/cert-2026-01" in homepage.data
    assert b'rel="noopener noreferrer"' in homepage.data

    deleted = client.post(f"/admin/certificates/{certificate_id}/delete", follow_redirects=True)
    assert b"Certificate deleted" in deleted.data
    with app.app_context():
        assert db.session.get(Certificate, certificate_id) is None


def test_certificate_public_order_featured_state_and_empty_state(app, client):
    with app.app_context():
        db.session.add_all(
            [
                Certificate(title="Later order", issuer="Issuer B", issued_date=date(2026, 9, 1), display_order=3, is_active=True),
                Certificate(title="Older same order", issuer="Issuer A", issued_date=date(2025, 1, 1), display_order=1, is_active=True),
                Certificate(title="Newest same order", issuer="Issuer C", issued_date=date(2026, 1, 1), image_url="https://res.cloudinary.com/demo/image/upload/certificate.png", display_order=1, is_active=True, is_featured=True),
                Certificate(title="Hidden credential", issuer="Issuer D", issued_date=date(2026, 1, 1), display_order=0, is_active=False),
            ]
        )
        db.session.commit()

    markup = client.get("/").data.decode()
    assert markup.index("Newest same order") < markup.index("Older same order") < markup.index("Later order")
    assert "Hidden credential" not in markup
    assert 'certificate-card is-featured' in markup
    assert 'id="certificates"' in markup
    assert "data-image-fallback" in markup


def test_invalid_certificate_image_is_rejected(app, client, auth):
    auth.login()
    response = client.post(
        "/admin/certificates/new",
        data=certificate_data(image=(io.BytesIO(b"not an image"), "fake.png")),
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"not a valid JPEG, PNG, or WebP image" in response.data
    with app.app_context():
        assert Certificate.query.count() == 0
