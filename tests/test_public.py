from app.models import ContactMessage


def test_public_pages_and_project_visibility(client):
    assert client.get("/").status_code == 200
    assert client.get("/projects").status_code == 200
    assert client.get("/about").status_code == 200
    assert client.get("/contact").status_code == 200
    assert client.get("/projects/published-work").status_code == 200
    assert client.get("/projects/private-draft").status_code == 404


def test_contact_submission_is_stored(app, client):
    response = client.post("/contact", data={"name": "A Visitor", "email": "visitor@example.com", "subject": "A useful project", "message": "I would like to discuss a real project with you.", "website": ""}, follow_redirects=True)
    assert response.status_code == 200
    assert b"your message is in" in response.data
    with app.app_context():
        message = ContactMessage.query.one()
        assert message.email == "visitor@example.com"
        assert message.is_read is False


def test_contact_validation(client):
    response = client.post("/contact", data={"name": "", "email": "not-email", "subject": "", "message": "short"})
    assert response.status_code == 200
    assert b"This field is required" in response.data


def test_seo_endpoints(client):
    assert client.get("/robots.txt").status_code == 200
    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    assert b"published-work" in sitemap.data
    assert b"private-draft" not in sitemap.data


def test_public_identity_contact_and_footer(client):
    pages = [client.get(path).data.decode() for path in ("/", "/about", "/contact")]
    combined = "\n".join(pages)
    assert "Ravi Kumar Tiwari" in combined
    assert 'mailto:ravi.tiwari2303@gmail.com' in combined
    assert 'https://github.com/Ravi-Tiwari-23' in combined
    assert 'https://linkedin.com/in/ravi-tiwari-a49259359' in combined
    assert 'rel="noopener noreferrer"' in combined
    assert 'data-footer' in combined
    assert "Back to top" in combined
    assert "tel:" not in combined
