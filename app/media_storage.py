"""Validated image storage with Cloudinary and local-development backends."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import uuid
from urllib.parse import urlsplit

from flask import current_app, url_for
from PIL import Image, UnidentifiedImageError
from werkzeug.utils import secure_filename


ALLOWED_IMAGE_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class StoredImage:
    location: str
    public_id: str | None = None


def cloudinary_configured():
    return all(
        current_app.config.get(key)
        for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    )


def _validated_image_bytes(storage):
    extension = Path(secure_filename(storage.filename or "")).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("The uploaded file must be a JPEG, PNG, or WebP image.")

    storage.stream.seek(0)
    source = storage.stream.read()
    storage.stream.seek(0)
    try:
        with Image.open(BytesIO(source)) as image:
            image.verify()
        with Image.open(BytesIO(source)) as image:
            image_format = image.format
            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError("Unsupported image format")
            image.thumbnail((2400, 2400))
            output = BytesIO()
            image.save(output, format=image_format, optimize=True)
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValueError("The uploaded file is not a valid JPEG, PNG, or WebP image.") from None
    return output.getvalue(), ALLOWED_IMAGE_FORMATS[image_format]


def _configure_cloudinary():
    import cloudinary

    cloudinary.config(
        cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
        api_key=current_app.config["CLOUDINARY_API_KEY"],
        api_secret=current_app.config["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def store_image(storage, folder):
    image_bytes, extension = _validated_image_bytes(storage)
    if cloudinary_configured():
        try:
            _configure_cloudinary()
            import cloudinary.uploader

            result = cloudinary.uploader.upload(
                BytesIO(image_bytes),
                folder=folder,
                public_id=uuid.uuid4().hex,
                resource_type="image",
                overwrite=False,
            )
        except Exception:
            raise ValueError("The image could not be uploaded. Please try again; the existing image was not changed.") from None
        secure_url = result.get("secure_url", "")
        if not secure_url.startswith("https://"):
            raise ValueError("The image service did not return a secure image URL.")
        return StoredImage(secure_url, result.get("public_id"))

    filename = f"{uuid.uuid4().hex}{extension}"
    target = Path(current_app.config["UPLOAD_FOLDER"]) / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(image_bytes)
    return StoredImage(filename)


def delete_stored_image(location, public_id=None):
    """Best-effort cleanup performed only when the asset can be identified safely."""
    if public_id and cloudinary_configured():
        try:
            _configure_cloudinary()
            import cloudinary.uploader

            cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
            return
        except Exception:
            current_app.logger.warning("Cloudinary image cleanup failed for public id %s", public_id)
            return

    if not location or location.startswith(("http://", "https://", "static:")):
        return
    relative = location.replace("\\", "/").lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[8:]
    upload_root = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
    target = (upload_root / relative).resolve()
    if target.parent == upload_root:
        target.unlink(missing_ok=True)


def image_url(location):
    """Resolve legacy static/local references and persistent HTTPS URLs."""
    if not location:
        return None
    if location.startswith(("https://", "http://")):
        return location
    if location.startswith("static:"):
        return url_for("static", filename=location[7:].lstrip("/"))
    relative = location.replace("\\", "/").lstrip("/")
    if relative.startswith("uploads/"):
        relative = relative[8:]
    return url_for("main.media", filename=relative)


def responsive_image_url(location, width=None):
    """Add safe delivery transforms to Cloudinary image URLs only."""
    resolved = image_url(location)
    if not resolved:
        return resolved
    parsed = urlsplit(resolved)
    marker = "/image/upload/"
    if parsed.scheme != "https" or parsed.hostname != "res.cloudinary.com" or marker not in parsed.path:
        return resolved
    transforms = ["f_auto", "q_auto", "c_limit"]
    if width is not None:
        transforms.append(f"w_{max(64, min(int(width), 2400))}")
    return resolved.replace(marker, f"{marker}{','.join(transforms)}/", 1)
