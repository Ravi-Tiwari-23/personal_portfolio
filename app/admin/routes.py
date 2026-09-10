import re
import uuid
from pathlib import Path

from flask import abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import func

from app.extensions import db
from app.models import ContactMessage, Project, ProjectImage, SiteSetting, Technology
from app.media_storage import delete_stored_image, store_image

from . import bp
from .forms import ProjectForm, ResumeForm, SettingsForm


def slugify(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or f"project-{uuid.uuid4().hex[:8]}"


def unique_slug(value, project_id=None):
    base = slugify(value)
    slug = base
    counter = 2
    while Project.query.filter(Project.slug == slug, Project.id != project_id).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def sync_technologies(project, csv_value):
    project.technologies.clear()
    for raw in dict.fromkeys(name.strip() for name in (csv_value or "").split(",") if name.strip()):
        tech = Technology.query.filter(func.lower(Technology.name) == raw.lower()).first()
        if not tech:
            tech = Technology(name=raw, category="Tools")
        project.technologies.append(tech)


def apply_project_form(project, form):
    for field in ("title", "short_description", "description", "category", "year", "role", "problem", "solution", "features", "architecture", "results", "github_url", "live_url", "display_order"):
        setattr(project, field, getattr(form, field).data or "" if field != "display_order" else getattr(form, field).data or 0)
    project.process = form.development_process.data or ""
    project.slug = unique_slug(form.slug.data or form.title.data, project.id)
    project.featured = form.featured.data
    project.published = form.published.data
    sync_technologies(project, form.technologies.data)
    if form.thumbnail.data and form.thumbnail.data.filename:
        project.thumbnail = store_image(form.thumbnail.data, "portfolio/projects").location
    for index, storage in enumerate(form.gallery.data or []):
        if storage and storage.filename:
            project.images.append(ProjectImage(image_path=store_image(storage, "portfolio/projects").location, alt_text=f"{project.title} project view", display_order=len(project.images) + index))


@bp.get("")
@login_required
def dashboard():
    stats = {
        "projects": Project.query.count(),
        "published": Project.query.filter_by(published=True).count(),
        "drafts": Project.query.filter_by(published=False).count(),
        "messages": ContactMessage.query.count(),
        "unread": ContactMessage.query.filter_by(is_read=False).count(),
    }
    recent_messages = ContactMessage.query.order_by(ContactMessage.created_at.desc()).limit(5).all()
    return render_template("admin/dashboard.html", stats=stats, recent_messages=recent_messages)


@bp.get("/projects")
@login_required
def projects():
    items = Project.query.order_by(Project.display_order, Project.updated_at.desc()).all()
    return render_template("admin/projects.html", projects=items)


@bp.route("/projects/new", methods=["GET", "POST"])
@login_required
def project_new():
    form = ProjectForm()
    if form.validate_on_submit():
        project = Project()
        try:
            apply_project_form(project, form)
            db.session.add(project)
            db.session.commit()
            flash("Project created successfully.", "success")
            return redirect(url_for("admin.projects"))
        except ValueError as error:
            db.session.rollback()
            flash(str(error), "error")
    return render_template("admin/project_form.html", form=form, project=None)


@bp.route("/projects/<int:project_id>/edit", methods=["GET", "POST"])
@login_required
def project_edit(project_id):
    project = db.get_or_404(Project, project_id)
    form = ProjectForm(obj=project)
    if request.method == "GET":
        form.technologies.data = ", ".join(t.name for t in project.technologies)
        form.development_process.data = project.process
    if form.validate_on_submit():
        try:
            apply_project_form(project, form)
            db.session.commit()
            flash("Project updated successfully.", "success")
            return redirect(url_for("admin.projects"))
        except ValueError as error:
            db.session.rollback()
            flash(str(error), "error")
    return render_template("admin/project_form.html", form=form, project=project)


@bp.post("/projects/<int:project_id>/delete")
@login_required
def project_delete(project_id):
    project = db.get_or_404(Project, project_id)
    db.session.delete(project)
    db.session.commit()
    flash("Project deleted.", "success")
    return redirect(url_for("admin.projects"))


@bp.post("/projects/<int:project_id>/toggle")
@login_required
def project_toggle(project_id):
    project = db.get_or_404(Project, project_id)
    project.published = not project.published
    db.session.commit()
    flash(f"{project.title} is now {'published' if project.published else 'a draft'}.", "success")
    return redirect(url_for("admin.projects"))


@bp.get("/messages")
@login_required
def messages():
    items = ContactMessage.query.order_by(ContactMessage.created_at.desc()).all()
    return render_template("admin/messages.html", messages=items)


@bp.get("/messages/<int:message_id>")
@login_required
def message_detail(message_id):
    message = db.get_or_404(ContactMessage, message_id)
    if not message.is_read:
        message.is_read = True
        db.session.commit()
    return render_template("admin/message_detail.html", message=message)


@bp.post("/messages/<int:message_id>/toggle")
@login_required
def message_toggle(message_id):
    message = db.get_or_404(ContactMessage, message_id)
    message.is_read = not message.is_read
    db.session.commit()
    return redirect(request.referrer or url_for("admin.messages"))


@bp.post("/messages/<int:message_id>/delete")
@login_required
def message_delete(message_id):
    message = db.get_or_404(ContactMessage, message_id)
    db.session.delete(message)
    db.session.commit()
    flash("Message deleted.", "success")
    return redirect(url_for("admin.messages"))


@bp.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    data = {row.key: row.value for row in SiteSetting.query.all()}
    form = SettingsForm(data=data if request.method == "GET" else None)
    if form.validate_on_submit():
        for field in form._fields:
            if field not in {"csrf_token", "submit"}:
                SiteSetting.set(field, getattr(form, field).data)
        db.session.commit()
        flash("Profile and settings updated.", "success")
        return redirect(url_for("admin.settings"))
    return render_template("admin/settings.html", form=form)


@bp.route("/resume", methods=["GET", "POST"])
@login_required
def resume():
    form = ResumeForm()
    if form.validate_on_submit():
        storage = form.resume.data
        header = storage.stream.read(5)
        storage.stream.seek(0)
        if header != b"%PDF-":
            flash("That file is not a valid PDF.", "error")
            return render_template("admin/resume.html", form=form)
        filename = f"resume-{uuid.uuid4().hex}.pdf"
        target = Path(current_app.config["RESUME_FOLDER"]) / filename
        storage.save(target)
        old = SiteSetting.get("resume_path")
        SiteSetting.set("resume_path", filename)
        db.session.commit()
        if old and old != filename:
            (Path(current_app.config["RESUME_FOLDER"]) / old).unlink(missing_ok=True)
        flash("Résumé updated successfully.", "success")
        return redirect(url_for("admin.resume"))
    return render_template("admin/resume.html", form=form, current_resume=SiteSetting.get("resume_path"))


@bp.post("/images/<int:image_id>/delete")
@login_required
def image_delete(image_id):
    image = db.get_or_404(ProjectImage, image_id)
    project_id = image.project_id
    delete_stored_image(image.image_path)
    db.session.delete(image)
    db.session.commit()
    flash("Gallery image removed.", "success")
    return redirect(url_for("admin.project_edit", project_id=project_id))
