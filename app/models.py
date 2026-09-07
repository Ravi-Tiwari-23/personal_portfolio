from datetime import UTC, datetime

from flask_login import UserMixin

from .extensions import db, login_manager
from .project_urls import safe_project_url


project_technologies = db.Table(
    "project_technologies",
    db.Column("project_id", db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    db.Column("technology_id", db.Integer, db.ForeignKey("technologies.id", ondelete="CASCADE"), primary_key=True),
)


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    last_login = db.Column(db.DateTime)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


class Project(db.Model):
    __tablename__ = "projects"
    __table_args__ = (
        db.Index("ix_projects_public_order", "published", "display_order"),
        db.Index("ix_projects_featured_public", "published", "featured", "display_order"),
    )
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    slug = db.Column(db.String(180), unique=True, nullable=False, index=True)
    short_description = db.Column(db.String(360), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    category = db.Column(db.String(100), nullable=False, index=True)
    year = db.Column(db.String(12), nullable=False)
    role = db.Column(db.String(160), default="Lead Developer")
    problem = db.Column(db.Text, default="")
    solution = db.Column(db.Text, default="")
    features = db.Column(db.Text, default="")
    architecture = db.Column(db.Text, default="")
    process = db.Column(db.Text, default="")
    results = db.Column(db.Text, default="")
    thumbnail = db.Column(db.String(255))
    github_url = db.Column(db.String(500))
    live_url = db.Column(db.String(500))
    featured = db.Column(db.Boolean, default=False, nullable=False)
    published = db.Column(db.Boolean, default=False, nullable=False)
    display_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    technologies = db.relationship("Technology", secondary=project_technologies, back_populates="projects")
    images = db.relationship("ProjectImage", backref="project", cascade="all, delete-orphan", order_by="ProjectImage.display_order")

    @property
    def safe_live_url(self):
        return safe_project_url(self.live_url)

    @property
    def safe_github_url(self):
        return safe_project_url(self.github_url)

    @property
    def destination_url(self):
        return self.safe_live_url or self.safe_github_url

    @property
    def feature_list(self):
        return [line.strip(" -") for line in (self.features or "").splitlines() if line.strip()]


class Technology(db.Model):
    __tablename__ = "technologies"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    category = db.Column(db.String(80), default="Tools", nullable=False)
    projects = db.relationship("Project", secondary=project_technologies, back_populates="technologies")


class ProjectImage(db.Model):
    __tablename__ = "project_images"
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    image_path = db.Column(db.String(255), nullable=False)
    alt_text = db.Column(db.String(255), nullable=False, default="Project image")
    display_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


class ContactMessage(db.Model):
    __tablename__ = "contact_messages"
    __table_args__ = (db.Index("ix_contact_messages_read_created", "is_read", "created_at"),)
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, index=True)
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False, index=True)


class Experience(db.Model):
    __tablename__ = "experiences"
    id = db.Column(db.Integer, primary_key=True)
    company = db.Column(db.String(160), nullable=False)
    position = db.Column(db.String(160), nullable=False)
    start_date = db.Column(db.String(30), nullable=False)
    end_date = db.Column(db.String(30))
    description = db.Column(db.Text, default="")
    technologies = db.Column(db.String(500), default="")
    current = db.Column(db.Boolean, default=False, nullable=False)
    display_order = db.Column(db.Integer, default=0, nullable=False)


class SiteSetting(db.Model):
    __tablename__ = "site_settings"
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, default="", nullable=False)

    @classmethod
    def get(cls, key, default=""):
        item = db.session.get(cls, key)
        return item.value if item else default

    @classmethod
    def set(cls, key, value):
        item = db.session.get(cls, key)
        if item:
            item.value = value or ""
        else:
            db.session.add(cls(key=key, value=value or ""))
