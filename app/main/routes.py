from datetime import UTC, datetime, timedelta

from flask import Response, current_app, flash, redirect, render_template, request, send_from_directory, url_for
from sqlalchemy import or_
from werkzeug.utils import safe_join

from app.extensions import db, limiter
from app.models import Certificate, ContactMessage, Experience, Project, SiteSetting, Technology, Skill

from . import bp
from .forms import ContactForm


@bp.get("/")
def index():
    projects = Project.query.filter_by(published=True, featured=True).order_by(Project.display_order, Project.created_at.desc()).limit(5).all()
    experiences = Experience.query.order_by(Experience.display_order, Experience.id).all()
    skills = Skill.query.filter_by(is_active=True).order_by(Skill.display_order, Skill.id).all()
    certificates = Certificate.query.filter_by(is_active=True).order_by(Certificate.display_order, Certificate.issued_date.desc(), Certificate.id).all()
    return render_template("index.html", projects=projects, experiences=experiences, skills=skills, certificates=certificates)


@bp.get("/about")
def about():
    experiences = Experience.query.order_by(Experience.display_order, Experience.id).all()
    technologies = Technology.query.filter(Technology.projects.any()).order_by(Technology.category, Technology.name).all()
    grouped = {}
    for technology in technologies:
        grouped.setdefault(technology.category, []).append(technology)
    return render_template("about.html", experiences=experiences, technology_groups=grouped)


@bp.route("/contact", methods=["GET", "POST"])
@limiter.limit("5 per hour", methods=["POST"])
def contact():
    form = ContactForm()
    if form.validate_on_submit():
        if form.website.data:
            return redirect(url_for("main.contact"))
        cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=2)
        duplicate = ContactMessage.query.filter(
            ContactMessage.email == form.email.data.strip().lower(),
            ContactMessage.message == form.message.data.strip(),
            ContactMessage.created_at >= cutoff,
        ).first()
        if duplicate:
            flash("That message was already received.", "info")
        else:
            db.session.add(ContactMessage(name=form.name.data.strip(), email=form.email.data.strip().lower(), subject=form.subject.data.strip(), message=form.message.data.strip()))
            db.session.commit()
            flash("Thanks — your message is in. I’ll get back to you soon.", "success")
        return redirect(url_for("main.contact"))
    return render_template("contact.html", form=form)


@bp.get("/resume/download")
@limiter.limit("30 per hour")
def resume_download():
    resume_path = SiteSetting.get("resume_path")
    if not resume_path:
        flash("The latest résumé is being prepared. Please get in touch in the meantime.", "info")
        return redirect(url_for("main.contact"))
    return send_from_directory(current_app.config["RESUME_FOLDER"], resume_path, as_attachment=True, download_name="Ravi_Kumar_Tiwari_Resume.pdf", mimetype="application/pdf")


@bp.get("/media/<path:filename>")
def media(filename):
    if safe_join(str(current_app.config["UPLOAD_FOLDER"]), filename) is None:
        return ("Not found", 404)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename, max_age=86400)


@bp.get("/robots.txt")
def robots():
    body = f"User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: {url_for('main.sitemap', _external=True)}\n"
    return Response(body, mimetype="text/plain")


@bp.get("/sitemap.xml")
def sitemap():
    pages = [url_for("main.index", _external=True), url_for("projects.index", _external=True), url_for("main.about", _external=True), url_for("main.contact", _external=True)]
    pages.extend(url_for("projects.detail", slug=p.slug, _external=True) for p in Project.query.filter_by(published=True).all())
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(f"<url><loc>{page}</loc></url>" for page in pages) + "</urlset>"
    return Response(xml, mimetype="application/xml")
