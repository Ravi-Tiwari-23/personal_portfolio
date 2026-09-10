import os
from pathlib import Path

import click
from flask import Flask, render_template
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash

from config import Config

from .extensions import csrf, db, limiter, login_manager, migrate
from .media_storage import image_url
from .models import Certificate, Experience, Project, SiteSetting, Technology, User


DEFAULT_SETTINGS = {
    "site_title": "Ravi Kumar Tiwari | Python, Data, AI & Web Developer",
    "seo_description": "Portfolio of Ravi Kumar Tiwari, a Computer Science undergraduate building Python, data, AI, Django, and web applications.",
    "name": "Ravi Kumar Tiwari",
    "professional_title": "AI • Data • Python • Web Development",
    "hero_statement": "I build practical Python, data, AI, and web applications with a focus on useful outcomes.",
    "about": "I am a Computer Science undergraduate exploring Python, data, artificial intelligence, Django, and web development through practical projects.",
    "current_focus": "Currently focused on strengthening my software development foundations and building projects that turn ideas into useful applications.",
    "email": os.getenv("CONTACT_EMAIL", "ravi.tiwari2303@gmail.com"),
    "location": "India · Working globally",
    "availability": "Available for select collaborations",
    "github": "https://github.com/Ravi-Tiwari-23",
    "linkedin": "https://linkedin.com/in/ravi-tiwari-a49259359",
    "twitter": "",
    "footer_text": "Built with Python + Flask",
    "resume_path": "",
}


def create_app(config_class=Config):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    Path(app.config["RESUME_FOLDER"]).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)

    from .admin import bp as admin_bp
    from .auth import bp as auth_bp
    from .main import bp as main_bp
    from .projects import bp as projects_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)

    register_commands(app)
    register_context(app)
    register_errors(app)
    register_security_headers(app)

    with app.app_context():
        if app.config.get("AUTO_SEED"):
            seed_defaults()

    return app


def register_context(app):
    @app.context_processor
    def inject_site():
        settings = {row.key: row.value for row in SiteSetting.query.all()}
        return {
            "site": {**DEFAULT_SETTINGS, **settings},
            "has_certificates": Certificate.query.filter_by(is_active=True).first() is not None,
            "image_url": image_url,
        }


def register_security_headers(app):
    @app.after_request
    def add_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: https://res.cloudinary.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
        )
        return response


def register_errors(app):
    for code in (400, 403, 404, 429, 500):
        app.register_error_handler(code, lambda error, code=code: (render_template("errors/error.html", code=code), code))


def register_commands(app):
    @app.cli.command("create-admin")
    @click.option("--username", prompt=True)
    @click.option("--email", prompt=True)
    @click.password_option()
    def create_admin(username, email, password):
        existing = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing:
            raise click.ClickException("That username or email already exists.")
        db.session.add(User(username=username.strip(), email=email.strip().lower(), password_hash=generate_password_hash(password)))
        db.session.commit()
        click.echo("Administrator created.")

    @app.cli.command("seed")
    def seed_command():
        seed_defaults(force_projects=True)
        click.echo("Portfolio content seeded.")

    @app.cli.command("seed-skills")
    def seed_skills_command():
        from .skill_catalog import seed_skills_once
        click.echo(f"Added {seed_skills_once()} skills. Existing edits and deletions are preserved.")


def seed_defaults(force_projects=False):
    changed = False
    for key, value in DEFAULT_SETTINGS.items():
        if db.session.get(SiteSetting, key) is None:
            db.session.add(SiteSetting(key=key, value=value))
            changed = True

    if not Experience.query.first():
        db.session.add_all([
            Experience(company="Personal Projects", position="Project-based Learning", start_date="2025", end_date="Present", current=True, description="Building practical applications while strengthening software development, data, AI, and web fundamentals.", technologies="Python · Django · Flask · JavaScript", display_order=1),
            Experience(company="Undergraduate Studies", position="Computer Science", start_date="2023", end_date="Present", current=True, description="Developing foundations in programming, databases, algorithms, and web systems through study and hands-on practice.", technologies="Python · SQL · Web Development", display_order=2),
        ])
        changed = True

    if force_projects or not Project.query.first():
        if not Project.query.first():
            tech_map = {}
            for name, category in [("Python", "Languages"), ("Django", "Backend"), ("HTML", "Frontend"), ("CSS", "Frontend"), ("Bootstrap", "Frontend"), ("JavaScript", "Languages")]:
                tech = Technology(name=name, category=category)
                db.session.add(tech)
                tech_map[name] = tech
            projects = [
                Project(title="ZARA – AI Desktop Assistant", slug="zara-ai-desktop-assistant", short_description="An AI desktop assistant project built with Python and a focused HTML/CSS interface.", description="ZARA explores practical assistant workflows through a Python-powered application and a clear, lightweight interface.", category="AI / Desktop", year="2026", role="Developer", features="Python-powered assistant workflows\nTask-oriented interactions\nHTML and CSS interface", architecture="Python handles the application logic while HTML and CSS provide the interface layer.", process="Built iteratively to connect assistant functionality with a straightforward user experience.", results="A practical exploration of Python-based AI assistance and interface design.", thumbnail="static:images/signal-architecture.webp", featured=True, published=True, display_order=1),
                Project(title="blog.genvilla", slug="blog-genvilla", short_description="A dynamic blogging platform built using Django with support for posts, categories, users, authentication, and content management.", description="A dynamic blogging platform built using Django with support for posts, categories, users, authentication, and content management.", category="Web Development", year="2026", role="Developer", features="Dynamic blog posts\nCategories\nUser system\nAuthentication\nAdmin management\nResponsive UI\nContent/blog management", architecture="Django provides the application structure, authentication, and content management, with HTML and Bootstrap shaping the responsive interface.", process="Developed around the core publishing flow from authenticated administration to responsive public reading.", results="A structured blogging application with practical publishing and content-management features.", featured=True, published=True, display_order=2),
                Project(title="genvilla.in", slug="genvilla-in", short_description="A real-estate finance and property-focused application designed around property cost estimation, financial calculations, and management functionality.", description="A real-estate finance and property-focused application designed around property cost estimation, financial calculations, and management functionality.", category="Python", year="2026", role="Developer", features="Property cost estimation\nLoan eligibility calculations\nEMI calculations\nProperty valuation\nFinancial calculations\nPython-based business logic", architecture="Python-based business logic supports the application's property and finance calculations.", process="Built by translating property and lending calculations into focused application workflows.", results="A practical Python application for common real-estate finance calculations.", featured=True, published=True, display_order=3),
                Project(title="Instagram Clone", slug="instagram-clone", short_description="A responsive front-end recreation of familiar social media interface patterns.", description="A front-end project focused on recreating a recognizable social feed experience with HTML, CSS, and JavaScript.", category="Frontend", year="2026", role="Developer", features="Responsive social feed layout\nInteractive interface elements\nMobile-friendly styling", architecture="Semantic HTML provides structure, CSS handles the responsive visual system, and JavaScript supports interface interactions.", process="Created by breaking the interface into reusable sections and refining its behavior across screen sizes.", results="A focused exercise in responsive front-end implementation and interaction design.", featured=True, published=True, display_order=4),
                Project(title="Personal Portfolio Website", slug="personal-portfolio-website", short_description="A responsive personal portfolio interface for presenting projects, skills, and contact details.", description="A portfolio website created with HTML, CSS, and Bootstrap to organize personal work in a clear, accessible format.", category="Portfolio", year="2026", role="Developer", features="Responsive portfolio layout\nProject presentation\nSkills and contact sections", architecture="HTML structures the content, CSS defines the visual language, and Bootstrap supports responsive layout behavior.", process="Designed around clear information hierarchy, responsive composition, and direct access to project and contact information.", results="A concise web presence for presenting technical projects and skills.", featured=True, published=True, display_order=5),
            ]
            projects[0].technologies = [tech_map[n] for n in ("Python", "HTML", "CSS")]
            projects[1].technologies = [tech_map[n] for n in ("Python", "Django", "HTML", "Bootstrap")]
            projects[2].technologies = [tech_map["Python"]]
            projects[3].technologies = [tech_map[n] for n in ("HTML", "CSS", "JavaScript")]
            projects[4].technologies = [tech_map[n] for n in ("HTML", "CSS", "Bootstrap")]
            db.session.add_all(projects)
            changed = True

    admin_username = os.getenv("ADMIN_USERNAME")
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    if admin_username and admin_email and admin_password and not User.query.first():
        db.session.add(User(username=admin_username, email=admin_email.lower(), password_hash=generate_password_hash(admin_password)))
        changed = True

    if changed:
        db.session.commit()
    from .skill_catalog import seed_skills_once
    seed_skills_once()
