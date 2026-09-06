from flask import abort, render_template, request

from app.models import Project

from . import bp


@bp.get("")
def index():
    projects = Project.query.filter_by(published=True).order_by(Project.display_order, Project.created_at.desc()).all()
    categories = sorted({project.category for project in projects})
    active = request.args.get("category", "").strip()
    if active:
        projects = [project for project in projects if project.category.lower() == active.lower()]
    return render_template("projects/index.html", projects=projects, categories=categories, active_category=active)


@bp.get("/<slug>")
def detail(slug):
    project = Project.query.filter_by(slug=slug, published=True).first_or_404()
    ordered = Project.query.filter_by(published=True).order_by(Project.display_order, Project.id).all()
    index = ordered.index(project)
    previous = ordered[index - 1] if index > 0 else ordered[-1] if len(ordered) > 1 else None
    following = ordered[index + 1] if index < len(ordered) - 1 else ordered[0] if len(ordered) > 1 else None
    return render_template("projects/detail.html", project=project, previous=previous, following=following)

