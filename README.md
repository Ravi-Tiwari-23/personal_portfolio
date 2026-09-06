# Ravi Tiwari — Portfolio & Project CMS

A production-oriented Flask portfolio with an editorial public experience and a focused private admin dashboard. It includes project case studies, publishing controls, secure contact storage, résumé replacement, image uploads, profile settings, SEO endpoints, responsive interaction, and reduced-motion support.

## What is included

- Public home, work, case-study, about, contact, résumé, sitemap, robots, and error routes
- Featured/published project states, human-readable slugs, technology relationships, gallery media, and previous/next navigation
- Password-hashed admin authentication and protected dashboard
- Project CRUD, publish/unpublish, featured ordering, profile/settings editing, messages, and résumé management
- CSRF protection, contact throttling, honeypot spam defense, secure sessions, upload verification, security headers, and escaped output
- SQLite for local development and PostgreSQL support through `DATABASE_URL`
- Keyboard-friendly navigation, visible focus, responsive layouts, and `prefers-reduced-motion`

## Local setup

Python 3.11+ is recommended.

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and replace `SECRET_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The first development start seeds representative project content and creates an administrator when all three `ADMIN_*` variables are present.

```powershell
flask --app run.py run --debug
```

Open `http://127.0.0.1:5000`. The admin login is at `http://127.0.0.1:5000/admin/login`.

If you prefer not to keep an administrator password in `.env`, omit the `ADMIN_*` values and run:

```powershell
flask --app run.py create-admin
```

## Database and production

The app creates tables automatically for a clean development database. For deployed environments, use migrations:

```powershell
flask --app run.py db init
flask --app run.py db migrate -m "Initial schema"
flask --app run.py db upgrade
```

Set `DATABASE_URL` to a PostgreSQL connection string in production, set `SESSION_COOKIE_SECURE=1` and `AUTO_SEED=0`, serve behind HTTPS, run `flask --app run.py db upgrade`, and use a persistent/object-backed media volume. Run with:

```text
gunicorn run:app
```

## Tests

```powershell
pytest -q
```

## Content notes

Seeded copy and social URLs are representative. Replace them from **Admin → Profile & settings**. Upload the production résumé from **Admin → Résumé** and update each project with real links, outcomes, and screenshots before launch.

The generated abstract project cover is located at `app/static/images/signal-architecture.webp` and was created specifically for this portfolio.
