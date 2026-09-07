from html.parser import HTMLParser

import pytest

from app.extensions import db
from app.models import Project
from app.project_urls import safe_project_url


class Links(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.anchors = []
        self.anchor_depth = 0
        self.nested = False
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.nested |= self.anchor_depth > 0
            self.anchor_depth += 1
            self.anchors.append(dict(attrs))

    def handle_endtag(self, tag):
        if tag == "a":
            self.anchor_depth -= 1


@pytest.mark.parametrize("live,github,primary", [
    ("https://demo.example.com", "https://github.com/ravi/demo", "https://demo.example.com"),
    ("", "github.com/ravi/demo", "https://github.com/ravi/demo"),
    ("", "", "/projects/published-work"),
])
def test_project_card_destinations(app, client, live, github, primary):
    with app.app_context():
        project = Project.query.filter_by(slug="published-work").one()
        project.live_url, project.github_url = live, github
        db.session.commit()
    for path in ("/", "/projects", "/projects/published-work"):
        links = Links(client.get(path).text)
        assert not links.nested
        external = [link for link in links.anchors if "project-action" in link.get("class", "") and link.get("target") == "_blank"]
        assert {link["href"] for link in external} == {safe_project_url(url) for url in (live, github) if url}
        for link in external:
            assert set(link["rel"].split()) >= {"noopener", "noreferrer"}
            assert "opens in a new tab" in link["aria-label"]
        if path != "/projects/published-work":
            visual = next(link for link in links.anchors if "project-visual" in link.get("class", ""))
            assert visual["href"] == primary
            assert any(link.get("href") == "/projects/published-work" and "project-action-detail" in link.get("class", "") for link in links.anchors)


@pytest.mark.parametrize("bad_url", ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:password@example.com", "https://example.com\\bad", "https://example.com:99999"])
def test_unsafe_existing_links_are_not_rendered(app, client, bad_url):
    with app.app_context():
        project = Project.query.filter_by(slug="published-work").one()
        project.live_url = bad_url
        project.github_url = bad_url
        db.session.commit()
    for path in ("/", "/projects", "/projects/published-work"):
        assert bad_url not in client.get(path).text


def project_data(**changes):
    return dict(title="Linked Project", short_description="A project with direct links.", description="Overview", category="Web", year="2026", display_order="3", published="y", featured="y", **changes)


def test_pasting_links_saves_normalized_urls_and_updates_buttons(app, client, auth):
    auth.login()
    response = client.post("/admin/projects/new", data=project_data(github_url=" github.com/ravi/demo ", live_url="demo.example.com/path?view=live#preview"), follow_redirects=True)
    assert "Project created successfully" in response.text
    with app.app_context():
        project = Project.query.filter_by(slug="linked-project").one()
        project_id = project.id
        assert project.github_url == "https://github.com/ravi/demo"
        assert project.live_url == "https://demo.example.com/path?view=live#preview"
    assert 'href="https://demo.example.com/path?view=live#preview"' in client.get("/projects").text
    response = client.post(f"/admin/projects/{project_id}/edit", data=project_data(github_url="", live_url=""), follow_redirects=True)
    assert "Project updated successfully" in response.text
    assert "https://demo.example.com" not in client.get("/projects").text


@pytest.mark.parametrize("bad_url", ["javascript:alert(1)", "ftp://example.com", "https://user:password@example.com"])
def test_editor_rejects_unsafe_urls(app, client, auth, bad_url):
    auth.login()
    response = client.post("/admin/projects/new", data=project_data(live_url=bad_url))
    assert "Project created successfully" not in response.text
    with app.app_context():
        assert Project.query.filter_by(slug="linked-project").count() == 0


def test_public_polish_is_not_loaded_in_admin(client):
    for path in ("/", "/about", "/projects", "/contact"):
        markup = client.get(path).text
        assert "css/portfolio-polish.css" in markup
        assert 'class="cursor-orbit"' in markup
    assert "portfolio-polish.css" not in client.get("/admin/login").text
