from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField, FileRequired, MultipleFileField
from wtforms import BooleanField, IntegerField, StringField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, Length, NumberRange, Optional, URL


class ProjectForm(FlaskForm):
    title = StringField("Title", validators=[DataRequired(), Length(max=160)])
    slug = StringField("Slug", validators=[Optional(), Length(max=180)])
    short_description = TextAreaField("Short description", validators=[DataRequired(), Length(max=360)])
    description = TextAreaField("Overview", validators=[DataRequired()])
    category = StringField("Category", validators=[DataRequired(), Length(max=100)])
    year = StringField("Year", validators=[DataRequired(), Length(max=12)])
    role = StringField("Role", validators=[Optional(), Length(max=160)])
    technologies = StringField("Technologies (comma separated)", validators=[Optional(), Length(max=600)])
    problem = TextAreaField("Problem")
    solution = TextAreaField("Solution")
    features = TextAreaField("Features (one per line)")
    architecture = TextAreaField("Architecture")
    development_process = TextAreaField("Development process")
    results = TextAreaField("Results")
    github_url = StringField("GitHub URL", validators=[Optional(), URL(), Length(max=500)])
    live_url = StringField("Live URL", validators=[Optional(), URL(), Length(max=500)])
    thumbnail = FileField("Thumbnail", validators=[FileAllowed(["jpg", "jpeg", "png", "webp"], "Upload a JPEG, PNG, or WebP image.")])
    gallery = MultipleFileField("Gallery images", validators=[FileAllowed(["jpg", "jpeg", "png", "webp"], "Upload JPEG, PNG, or WebP images.")])
    featured = BooleanField("Featured")
    published = BooleanField("Published")
    display_order = IntegerField("Display order", validators=[NumberRange(min=0, max=9999)], default=0)
    submit = SubmitField("Save project")


class SettingsForm(FlaskForm):
    site_title = StringField("Site title", validators=[DataRequired(), Length(max=200)])
    seo_description = TextAreaField("SEO description", validators=[DataRequired(), Length(max=320)])
    name = StringField("Name", validators=[DataRequired(), Length(max=120)])
    professional_title = StringField("Professional title", validators=[DataRequired(), Length(max=200)])
    hero_statement = TextAreaField("Hero statement", validators=[DataRequired(), Length(max=300)])
    about = TextAreaField("About", validators=[DataRequired(), Length(max=3000)])
    current_focus = TextAreaField("Current focus", validators=[Optional(), Length(max=1000)])
    email = StringField("Public email", validators=[DataRequired(), Length(max=255)])
    location = StringField("Location", validators=[Optional(), Length(max=160)])
    availability = StringField("Availability", validators=[Optional(), Length(max=160)])
    github = StringField("GitHub", validators=[Optional(), URL(), Length(max=500)])
    linkedin = StringField("LinkedIn", validators=[Optional(), URL(), Length(max=500)])
    twitter = StringField("X / Twitter", validators=[Optional(), URL(), Length(max=500)])
    footer_text = StringField("Footer text", validators=[Optional(), Length(max=200)])
    submit = SubmitField("Save profile & settings")


class ResumeForm(FlaskForm):
    resume = FileField("Résumé PDF", validators=[FileRequired(), FileAllowed(["pdf"], "Upload a PDF file.")])
    submit = SubmitField("Replace résumé")
