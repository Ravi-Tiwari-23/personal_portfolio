import re
from pathlib import Path

import pytest

from app.extensions import db
from app.models import Project, Skill
from app.skill_catalog import INITIAL_SKILLS, seed_skills_once


@pytest.fixture()
def seeded_skills(app):
    with app.app_context():
        assert seed_skills_once() == 10


def skill_data(**overrides):
    data = dict(name="FastAPI", category="Backend", description="API development.", icon_type="initials", icon="", emoji="", accent_color="#75B9EC", display_order="11", is_active="y")
    data.update(overrides)
    return data


def test_seed_is_unique_preserves_edits_and_does_not_restore_deleted_skills(app, seeded_skills):
    with app.app_context():
        django = Skill.query.filter_by(slug="django").one()
        django.description = "My own description"
        django.is_active = False
        db.session.delete(Skill.query.filter_by(slug="python").one())
        db.session.commit()
        assert seed_skills_once() == 0
        assert Skill.query.count() == 9
        assert django.description == "My own description"
        assert not django.is_active
        assert Project.query.count() == 2


def test_seed_reuses_existing_skill_names(app):
    with app.app_context():
        db.session.add(Skill(name="PYTHON", slug="custom-python", category="My category", description="My copy", is_active=False))
        db.session.commit()
        assert seed_skills_once() == 9
        assert Skill.query.count() == 10
        assert Skill.query.filter_by(slug="custom-python").one().category == "My category"


def test_public_skills_are_semantic_ordered_and_have_local_logos(app, client, seeded_skills):
    markup = client.get("/").text.split('id="skills"', 1)[1].split('<section class="experience', 1)[0]
    assert markup.count('data-skill-row') == 10
    names = re.findall(r'<span class="skill-name">(.*?)</span>', markup)
    assert names == [row[0] for row in INITIAL_SKILLS]
    assert names.count("JavaScript") == 1
    assert markup.count('aria-controls="skill-detail-') == 10
    with app.app_context():
        for skill in Skill.query.all():
            assert skill.icon_filename
            response = client.get("/static/" + skill.icon_filename)
            assert response.status_code == 200
            assert b"<svg" in response.data


def test_empty_state_and_hidden_skills(client, app, seeded_skills):
    with app.app_context():
        Skill.query.update({Skill.is_active: False})
        db.session.commit()
    markup = client.get("/").text
    assert 'data-skill-row' not in markup
    assert "My toolkit is being updated" in markup


def test_admin_skill_crud_toggle_order_and_confirmation(app, client, auth, seeded_skills):
    auth.login()
    assert client.get("/admin/skills").status_code == 200
    response = client.post("/admin/skills/new", data=skill_data(), follow_redirects=True)
    assert "Skill added." in response.text
    with app.app_context():
        skill_id = Skill.query.filter_by(name="FastAPI").one().id
    response = client.post(f"/admin/skills/{skill_id}/edit", data=skill_data(name="FastAPI Toolkit", description="Updated copy", display_order="0"), follow_redirects=True)
    assert "Skill updated." in response.text
    markup = client.get("/").text
    assert markup.index('class="skill-name">FastAPI Toolkit') < markup.index('class="skill-name">Django')
    client.post(f"/admin/skills/{skill_id}/toggle")
    assert "FastAPI Toolkit" not in client.get("/").text
    assert "FastAPI Toolkit" in client.get("/admin/skills").text
    client.post(f"/admin/skills/{skill_id}/toggle")
    with app.app_context():
        ordered = Skill.query.order_by(Skill.id.desc()).all()
        order_data = {f"order_{skill.id}": index for index, skill in enumerate(ordered)}
    assert client.post("/admin/skills/reorder", data=order_data).status_code == 302
    assert client.post("/admin/skills/reorder", data={}).status_code == 400
    confirmation = client.get(f"/admin/skills/{skill_id}/delete")
    assert "Delete skill permanently" in confirmation.text
    assert client.post(f"/admin/skills/{skill_id}/delete").status_code == 400
    with app.app_context():
        assert db.session.get(Skill, skill_id) is not None
    assert client.post(f"/admin/skills/{skill_id}/delete", data={"confirm": "delete"}).status_code == 302
    with app.app_context():
        assert db.session.get(Skill, skill_id) is None
        assert Project.query.count() == 2
        assert seed_skills_once() == 0


@pytest.mark.parametrize("overrides", [dict(name="python"), dict(name="   "), dict(accent_color="red;display:none"), dict(icon="../../secrets.svg"), dict(icon_type="raw-html"), dict(display_order="-1")])
def test_admin_rejects_duplicates_and_unsafe_values(app, client, auth, seeded_skills, overrides):
    auth.login()
    response = client.post("/admin/skills/new", data=skill_data(**overrides))
    assert response.status_code == 200
    with app.app_context():
        assert Skill.query.count() == 10


def test_skill_routes_require_authentication_and_csrf(app, client, seeded_skills):
    for path in ("/admin/skills", "/admin/skills/new", "/admin/skills/1/edit", "/admin/skills/1/delete"):
        assert client.get(path).status_code == 302
    for path in ("/admin/skills/new", "/admin/skills/1/edit", "/admin/skills/1/delete", "/admin/skills/1/toggle", "/admin/skills/reorder"):
        assert client.post(path).status_code == 302
    app.config["WTF_CSRF_ENABLED"] = True
    page = client.get("/admin/login")
    token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', page.text).group(1)
    client.post("/admin/login", data={"csrf_token": token, "identity": "ravi", "password": "correct-horse-battery-staple"})
    assert client.post("/admin/skills/new", data=skill_data()).status_code == 400
    assert client.post("/admin/skills/1/toggle").status_code == 400
    assert client.post("/admin/skills/1/delete", data={"confirm": "delete"}).status_code == 400
    assert client.post("/admin/skills/reorder", data={}).status_code == 400


def test_skill_content_is_escaped_and_missing_icons_fall_back(app, client, seeded_skills):
    with app.app_context():
        skill = Skill.query.first()
        skill.name = '<script>alert(1)</script>'
        skill.icon = "missing"
        skill.emoji = "⚙️"
        skill.accent_color = "bad css"
        assert skill.icon_filename is None
        assert skill.safe_accent == "#FF7657"
        assert skill.fallback_mark == "⚙️"
        skill.icon_type = "initials"
        assert skill.fallback_mark == "<S"
        db.session.commit()
    markup = client.get("/").text
    assert "<script>alert(1)</script>" not in markup
    assert "&lt;script&gt;" in markup
    assert "/missing" not in markup


def test_skills_migration_is_additive_and_seed_command_is_idempotent(app, tmp_path):
    # Exercise the real migration against an isolated existing-schema database.
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    import importlib.util
    from sqlalchemy import create_engine, inspect
    migration_path = Path(__file__).parents[1] / "migrations/versions/e24b0918a201_add_editorial_skills.py"
    spec = importlib.util.spec_from_file_location("skills_migration", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///" + str(tmp_path / "migration.sqlite3"))
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE project_sentinel (id INTEGER PRIMARY KEY, title TEXT)")
        conn.exec_driver_sql("INSERT INTO project_sentinel VALUES (1, 'Keep this project')")
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            migration.upgrade()
        assert "skills" in inspect(conn).get_table_names()
        assert conn.exec_driver_sql("SELECT title FROM project_sentinel").scalar_one() == "Keep this project"
        assert len(inspect(conn).get_columns("skills")) == 13
    engine.dispose()
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed-skills"]).exit_code == 0
    assert "Added 0 skills" in runner.invoke(args=["seed-skills"]).output
