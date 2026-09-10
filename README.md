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

The app creates tables automatically for a clean development database. Migrations are already included; do not run `db init` again. For deployed environments with an established migration history, set `AUTO_SEED=0` and run:

```powershell
flask --app run.py db upgrade
flask --app run.py seed-skills
```

Set `DATABASE_URL` to a PostgreSQL connection string in production, set `SESSION_COOKIE_SECURE=1` and `AUTO_SEED=0`, serve behind HTTPS, and run `flask --app run.py db upgrade`. For persistent project and certificate images on Render, configure all three Cloudinary variables:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

When those variables are absent, validated images continue to use `instance/uploads` for local development. Run the web service with:

```text
gunicorn run:app
```

## Tests

```powershell
pytest -q
```

## Content notes

### Skills editor

Use **Admin → Skills** to add/edit skills, choose a local logo or fallback,
change accent colors, hide/show rows, and save display order. Deleting a skill
requires a separate confirmation page and never changes project technology tags.
The ten initial skills are seeded once; subsequent restarts or `seed-skills` runs
preserve admin edits, hidden states, and deletions.

For an older development database created with `AUTO_SEED=1`, the next start adds
the new skills table and seeds it without replacing existing content. Back up the
database before any schema update. Do not run a fresh initial migration against
an existing unstamped database; first reconcile its schema and migration baseline.

Skill logos are local SVGs from Devicon and Simple Icons; attribution and licenses
are in `app/static/images/skills/NOTICE.md`. New arbitrary skills can use initials
or an emoji fallback without uploading executable SVG content.

Seeded copy and social URLs are representative. Replace them from **Admin → Profile & settings**. Upload the production résumé from **Admin → Résumé** and update each project with real links, outcomes, and screenshots before launch.

The generated abstract project cover is located at `app/static/images/signal-architecture.webp` and was created specifically for this portfolio.
