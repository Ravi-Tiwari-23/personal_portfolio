"""Initial editorial skills and the allowlisted local icon catalogue."""
SKILL_ICONS = {
    "django": "django.svg", "python": "python.svg", "html": "html.svg",
    "css": "css.svg", "bootstrap": "bootstrap.svg", "javascript": "javascript.svg",
    "cloudinary": "cloudinary.svg", "spss": "spss.svg", "mysql": "mysql.svg", "mongodb": "mongodb.svg",
}

INITIAL_SKILLS = [
    ("Django", "django", "Backend", "Python web framework for backend applications.", "django", "#44B78B", "⚙️"),
    ("Python", "python", "Programming / Backend", "Scripting, backend logic, automation and data workflows.", "python", "#75B9EC", "🐍"),
    ("HTML", "html", "Frontend", "Semantic structure for accessible web interfaces.", "html", "#F08055", "🧱"),
    ("CSS", "css", "Frontend", "Responsive layouts, animation and visual styling.", "css", "#68ACF5", "🎨"),
    ("Bootstrap", "bootstrap", "Frontend", "Responsive interfaces and reusable UI components.", "bootstrap", "#B28AFF", "🧩"),
    ("JavaScript", "javascript", "Frontend / Programming", "Interactive browser behavior and frontend logic.", "javascript", "#EAD65C", "⚡"),
    ("Cloudinary", "cloudinary", "Cloud / Media", "Cloud image storage, delivery and media optimization.", "cloudinary", "#79A3FF", "☁️"),
    ("IBM SPSS", "ibm-spss", "Data Analysis", "Statistical analysis and data interpretation.", "spss", "#ED83B6", "📊"),
    ("MySQL", "mysql", "Database", "Relational data storage, querying and structured data workflows.", "mysql", "#60BCD4", "🗄️"),
    ("MongoDB", "mongodb", "Database", "Document-based NoSQL data storage.", "mongodb", "#65C97C", "🍃"),
]


def seed_skills_once():
    """Never replace edits, reactivate hidden rows, or recreate deleted defaults."""
    from sqlalchemy import func
    from .extensions import db
    from .models import Skill, SiteSetting

    if db.session.get(SiteSetting, "skills_v2_initialized"):
        return 0
    added = 0
    for order, (name, slug, category, description, icon, accent, emoji) in enumerate(INITIAL_SKILLS, 1):
        existing = Skill.query.filter((func.lower(Skill.name) == name.lower()) | (Skill.slug == slug)).first()
        if existing:
            continue
        db.session.add(Skill(name=name, slug=slug, category=category, description=description,
                             icon=icon, icon_type="builtin", accent_color=accent, emoji=emoji,
                             display_order=order, is_active=True))
        added += 1
    SiteSetting.set("skills_v2_initialized", "1")
    db.session.commit()
    return added
