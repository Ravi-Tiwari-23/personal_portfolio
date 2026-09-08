"""Skills use the existing admin authentication, CSRF protection and layout."""
from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Skill
from . import bp
from .forms import SkillForm
from .routes import slugify


@bp.get("/skills")
@login_required
def skills():
    return render_template("admin/skills.html", skills=Skill.query.order_by(Skill.display_order, Skill.id).all())


@bp.route("/skills/new", methods=["GET", "POST"])
@bp.route("/skills/<int:skill_id>/edit", methods=["GET", "POST"])
@login_required
def skill_edit(skill_id=None):
    skill = db.get_or_404(Skill, skill_id) if skill_id is not None else None
    form = SkillForm(obj=skill)
    if form.validate_on_submit():
        duplicate = Skill.query.filter(func.lower(Skill.name) == form.name.data.lower(), Skill.id != skill_id).first()
        if duplicate:
            form.name.errors.append("A skill with this name already exists. Edit that skill instead.")
        else:
            creating = skill is None
            item = skill or Skill()
            for field in ("name", "category", "description", "icon", "icon_type", "accent_color", "emoji", "display_order", "is_active"):
                setattr(item, field, getattr(form, field).data)
            for field in ("description", "icon", "emoji"):
                setattr(item, field, getattr(item, field) or "")
            if creating:
                base = slugify(item.name)[:110]
                slug, suffix = base, 2
                while Skill.query.filter_by(slug=slug).first():
                    slug, suffix = f"{base}-{suffix}", suffix + 1
                item.slug = slug
                db.session.add(item)
            try:
                db.session.commit()
                flash("Skill added." if creating else "Skill updated.", "success")
                return redirect(url_for("admin.skills"))
            except IntegrityError:
                db.session.rollback()
                form.name.errors.append("A skill with this name already exists.")
    return render_template("admin/skill_form.html", form=form, skill=skill)


@bp.post("/skills/<int:skill_id>/toggle")
@login_required
def skill_toggle(skill_id):
    skill = db.get_or_404(Skill, skill_id)
    skill.is_active = not skill.is_active
    db.session.commit()
    flash("Skill visibility updated.", "success")
    return redirect(url_for("admin.skills"))


@bp.post("/skills/reorder")
@login_required
def skill_reorder():
    skills = Skill.query.all()
    orders = {}
    for skill in skills:
        try:
            value = int(request.form[f"order_{skill.id}"])
        except (KeyError, ValueError):
            abort(400)
        if not 0 <= value <= 9999:
            abort(400)
        orders[skill.id] = value
    for skill in skills:
        skill.display_order = orders[skill.id]
    db.session.commit()
    flash("Skill order saved.", "success")
    return redirect(url_for("admin.skills"))


@bp.route("/skills/<int:skill_id>/delete", methods=["GET", "POST"])
@login_required
def skill_delete(skill_id):
    skill = db.get_or_404(Skill, skill_id)
    if request.method == "POST":
        if request.form.get("confirm") != "delete":
            abort(400)
        db.session.delete(skill)
        db.session.commit()
        flash("Skill deleted.", "success")
        return redirect(url_for("admin.skills"))
    return render_template("admin/skill_delete.html", skill=skill)
