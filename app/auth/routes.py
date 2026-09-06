from datetime import UTC, datetime
from urllib.parse import urljoin, urlparse

from flask import flash, redirect, render_template, request, session, url_for
from flask_login import current_user, login_user, logout_user
from werkzeug.security import check_password_hash

from app.extensions import db, limiter
from app.models import User

from . import bp
from .forms import LoginForm


def is_safe_url(target):
    host_url = urlparse(request.host_url)
    redirect_url = urlparse(urljoin(request.host_url, target))
    return redirect_url.scheme in ("http", "https") and host_url.netloc == redirect_url.netloc


@bp.route("/login", methods=["GET", "POST"])
@limiter.limit("8 per 15 minutes", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("admin.dashboard"))
    form = LoginForm()
    if form.validate_on_submit():
        identity = form.identity.data.strip().lower()
        user = User.query.filter((User.username.ilike(identity)) | (User.email.ilike(identity))).first()
        if user and check_password_hash(user.password_hash, form.password.data):
            session.clear()
            login_user(user, remember=form.remember.data, fresh=True)
            session.permanent = True
            user.last_login = datetime.now(UTC).replace(tzinfo=None)
            db.session.commit()
            target = request.args.get("next")
            return redirect(target if target and is_safe_url(target) else url_for("admin.dashboard"))
        flash("The username or password is incorrect.", "error")
    return render_template("auth/login.html", form=form)


@bp.post("/logout")
def logout():
    logout_user()
    session.clear()
    flash("You have been signed out.", "info")
    return redirect(url_for("auth.login"))

