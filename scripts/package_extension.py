#!/usr/bin/env python3
"""
Builds the distributable PromptVault Chrome extension ZIP.

The ZIP contains only the contents of ./extension, placed at the ZIP root, so
extracting it yields a folder that Chrome's "Load unpacked" accepts directly.

Usage:
  # Local-development build (extension talks to http://localhost:8000 / :3000)
  python scripts/package_extension.py

  # Production build (rewrites the baked-in localhost URLs)
  python scripts/package_extension.py \
      --api-base https://api.example.com/api \
      --app-url  https://app.example.com
"""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "extension"
DEFAULT_OUT = ROOT / "release" / "PromptVault-Extension.zip"

LOCAL_API_BASE = "http://localhost:8000/api"
LOCAL_APP_URL = "http://localhost:3000"

# Never ship these, even if they appear inside the extension folder.
EXCLUDED_DIRS = {"node_modules", "__pycache__", ".git"}
EXCLUDED_SUFFIXES = {".map", ".md", ".zip", ".log", ".py", ".pyc", ".db", ".sqlite3", ".pem", ".key"}


def is_excluded(path: Path) -> bool:
    rel = path.relative_to(EXT_DIR)
    if any(part in EXCLUDED_DIRS or part.startswith(".") for part in rel.parts):
        return True
    name = path.name.lower()
    return name.startswith(".env") or name.startswith("package") or path.suffix.lower() in EXCLUDED_SUFFIXES


def origin(url: str, label: str) -> str:
    p = urlparse(url)
    if p.scheme not in ("https", "http") or not p.netloc:
        sys.exit(f"error: {label} must be a full URL, got {url!r}")
    if p.scheme == "http" and p.hostname not in ("localhost", "127.0.0.1"):
        sys.exit(f"error: {label} must use https for a deployed server, got {url!r}")
    return f"{p.scheme}://{p.netloc}"


def replace_once(text: str, old: str, new: str, filename: str, expected: int = 1) -> str:
    if text.count(old) != expected:
        sys.exit(f"error: expected {expected} occurrence(s) of {old!r} in {filename}, found {text.count(old)}")
    return text.replace(old, new)


def transform(name: str, data: bytes, api_base: str, app_url: str) -> bytes:
    """Rewrites localhost URLs for a production build. No-op for the local build."""
    if api_base == LOCAL_API_BASE and app_url == LOCAL_APP_URL:
        return data
    api_origin = origin(api_base, "--api-base")
    app_origin = origin(app_url, "--app-url")

    if name == "options.js":
        text = data.decode("utf-8")
        text = replace_once(text, f'DEFAULT_API_BASE = "{LOCAL_API_BASE}"', f'DEFAULT_API_BASE = "{api_base}"', name)
        return text.encode("utf-8")

    if name == "background.js":
        text = data.decode("utf-8")
        text = replace_once(text, f'DEFAULT_API_BASE = "{LOCAL_API_BASE}"', f'DEFAULT_API_BASE = "{api_base}"', name)
        text = replace_once(
            text,
            't.url && (t.url.includes("localhost:3000") || t.url.includes("127.0.0.1:3000"))',
            f't.url && t.url.startsWith("{app_origin}/")',
            name,
        )
        text = replace_once(text, f'"{LOCAL_APP_URL}/login"', f'"{app_origin}/login"', name, expected=2)
        return text.encode("utf-8")

    if name == "manifest.json":
        manifest = json.loads(data.decode("utf-8"))
        for cs in manifest.get("content_scripts", []):
            if "token_bridge.js" in cs.get("js", []):
                cs["matches"] = [f"{app_origin}/*"]
        hosts = [h for h in manifest.get("host_permissions", []) if "localhost" not in h and "127.0.0.1" not in h]
        manifest["host_permissions"] = [f"{api_origin}/*"] + hosts
        return (json.dumps(manifest, indent=2) + "\n").encode("utf-8")

    return data


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api-base", default=LOCAL_API_BASE, help="Deployed backend API URL (ending in /api)")
    ap.add_argument("--app-url", default=LOCAL_APP_URL, help="Deployed PromptVault web app URL")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output ZIP path")
    args = ap.parse_args()

    api_base = args.api_base.rstrip("/")
    app_url = args.app_url.rstrip("/")
    if (api_base == LOCAL_API_BASE) != (app_url == LOCAL_APP_URL):
        sys.exit("error: pass --api-base and --app-url together (or neither for a local build)")

    manifest_path = EXT_DIR / "manifest.json"
    if not manifest_path.is_file():
        sys.exit(f"error: {manifest_path} not found")
    version = json.loads(manifest_path.read_text(encoding="utf-8"))["version"]

    files = sorted(p for p in EXT_DIR.rglob("*") if p.is_file() and not is_excluded(p))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            rel = p.relative_to(EXT_DIR).as_posix()
            zf.writestr(rel, transform(rel, p.read_bytes(), api_base, app_url))

    digest = hashlib.sha256(args.out.read_bytes()).hexdigest()
    print(f"Built {args.out} (extension v{version}, {len(files)} files, {args.out.stat().st_size:,} bytes)")
    print(f"sha256 {digest}")
    if api_base == LOCAL_API_BASE:
        print("WARNING: local build - the extension points at http://localhost:8000 and only works on the developer's machine.")
    else:
        print(f"Production build: API {api_base}, web app {app_url}")


if __name__ == "__main__":
    main()
