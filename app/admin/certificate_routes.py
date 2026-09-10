"""Admin-managed certificate records and validated image uploads."""

from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import login_required

from app.extensions import db
from app.media_storage import delete_stored_image, store_image
from app.models import Certificate

from . import bp
from .forms import CertificateForm


@bp.get("/certificates")
@login_required
def certificates():
    items = Certificate.query.order_by(Certificate.display_order, Certificate.issued_date.desc(), Certificate.id).all()
    return render_template("admin/certificates.html", certificates=items)


@bp.route("/certificates/new", methods=["GET", "POST"])
@bp.route("/certificates/<int:certificate_id>/edit", methods=["GET", "POST"])
@login_required
def certificate_edit(certificate_id=None):
    certificate = db.get_or_404(Certificate, certificate_id) if certificate_id is not None else None
    form = CertificateForm(obj=certificate)
    if form.validate_on_submit():
        creating = certificate is None
        item = certificate or Certificate()
        old_location = item.image_url
        old_public_id = item.image_public_id
        new_image = None
        try:
            if form.image.data and form.image.data.filename:
                new_image = store_image(form.image.data, "portfolio/certificates")
            for field in ("title", "issuer", "description", "credential_id", "credential_url", "issued_date", "expiry_date", "display_order", "is_featured", "is_active"):
                setattr(item, field, getattr(form, field).data)
            item.description = item.description or ""
            item.credential_id = item.credential_id or None
            item.credential_url = item.credential_url or None
            if new_image:
                item.image_url = new_image.location
                item.image_public_id = new_image.public_id
            if creating:
                db.session.add(item)
            db.session.commit()
        except ValueError as error:
            db.session.rollback()
            flash(str(error), "error")
        else:
            if new_image and old_location and old_location != new_image.location and old_public_id != new_image.public_id:
                delete_stored_image(old_location, old_public_id)
            flash("Certificate added." if creating else "Certificate updated.", "success")
            return redirect(url_for("admin.certificates"))
    return render_template("admin/certificate_form.html", form=form, certificate=certificate)


@bp.post("/certificates/<int:certificate_id>/toggle")
@login_required
def certificate_toggle(certificate_id):
    certificate = db.get_or_404(Certificate, certificate_id)
    certificate.is_active = not certificate.is_active
    db.session.commit()
    flash("Certificate visibility updated.", "success")
    return redirect(url_for("admin.certificates"))


@bp.post("/certificates/<int:certificate_id>/feature")
@login_required
def certificate_feature(certificate_id):
    certificate = db.get_or_404(Certificate, certificate_id)
    certificate.is_featured = not certificate.is_featured
    db.session.commit()
    flash("Featured status updated.", "success")
    return redirect(url_for("admin.certificates"))


@bp.post("/certificates/reorder")
@login_required
def certificate_reorder():
    certificates = Certificate.query.all()
    orders = {}
    for certificate in certificates:
        try:
            value = int(request.form[f"order_{certificate.id}"])
        except (KeyError, ValueError):
            abort(400)
        if not 0 <= value <= 9999:
            abort(400)
        orders[certificate.id] = value
    for certificate in certificates:
        certificate.display_order = orders[certificate.id]
    db.session.commit()
    flash("Certificate order saved.", "success")
    return redirect(url_for("admin.certificates"))


@bp.post("/certificates/<int:certificate_id>/delete")
@login_required
def certificate_delete(certificate_id):
    certificate = db.get_or_404(Certificate, certificate_id)
    location = certificate.image_url
    public_id = certificate.image_public_id
    db.session.delete(certificate)
    db.session.commit()
    delete_stored_image(location, public_id)
    flash("Certificate deleted.", "success")
    return redirect(url_for("admin.certificates"))
