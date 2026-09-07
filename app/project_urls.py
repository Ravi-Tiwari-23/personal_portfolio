"""Normalize pasted project links without fetching remote resources."""
import re
from urllib.parse import urlsplit


def normalize_project_url(value):
    value = (value or "").strip()
    if not value:
        return ""
    if value.startswith("//"):
        return "https:" + value
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", value):
        return "https://" + value
    return value


def safe_project_url(value):
    value = normalize_project_url(value)
    if not value or any(char.isspace() or ord(char) < 32 for char in value) or "\\" in value:
        return ""
    try:
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {"https", "http"} or not parsed.hostname:
            return ""
        if parsed.username is not None or parsed.password is not None:
            return ""
        # Accessing port also validates malformed/out-of-range ports.
        parsed.port
    except ValueError:
        return ""
    return value
