import json
import os
import socket
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError, ExtractorError


JSON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)

ALLOWED_PROTOCOLS = {"http", "https"}
YOUTUBE_HOST_PARTS = ("youtube.com", "youtu.be", "youtube-nocookie.com")
PLATFORM_LABELS = {
    "instagram": "Instagram",
    "facebook": "Facebook",
    "fb.watch": "Facebook",
    "x.com": "X",
    "twitter.com": "X",
    "tiktok.com": "TikTok",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send_json(204, None)

    def do_POST(self):
        if self.path.rstrip("/") != "/api/parse":
            self._send_json(404, {"message": "Not found"})
            return

        body = self._read_json_body()
        if body is None:
            return

        link = body.get("link", "").strip() if isinstance(body, dict) else ""
        if not link:
            self._send_json(400, {"message": "Missing link"})
            return

        if not is_http_url(link):
            self._send_json(400, {"message": "Invalid link"})
            return

        try:
            payload = parse_link(link)
        except UnsupportedPlatformError as exc:
            self._send_json(422, {"message": str(exc)})
            return
        except UpstreamTimeoutError as exc:
            self._send_json(504, {"message": str(exc)})
            return
        except UpstreamRateLimitError as exc:
            self._send_json(429, {"message": str(exc)})
            return
        except Exception:
            self._send_json(
                502,
                {
                    "message": (
                        "Unable to process this link right now. "
                        "Please try again in a moment."
                    )
                },
            )
            return

        if not payload["formats"]:
            self._send_json(
                404,
                {"message": "Couldn't find any downloadable media from this link"},
            )
            return

        self._send_json(200, payload)

    def do_GET(self):
        if self.path in ("/api/parse", "/api/parse/"):
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "tokmora-python-parse",
                    "endpoint": "POST /api/parse/",
                },
            )
            return

        self._send_json(404, {"message": "Not found"})

    def log_message(self, format, *args):
        return

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"message": "Invalid Content-Length header"})
            return None

        try:
            raw = self.rfile.read(length) if length > 0 else b"{}"
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"message": "Invalid JSON body"})
            return None

    def _send_json(self, status_code, payload):
        self.send_response(status_code)
        for key, value in JSON_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()

        if payload is not None:
            self.wfile.write(json.dumps(strip_internal_fields(payload)).encode("utf-8"))


class UnsupportedPlatformError(Exception):
    pass


class UpstreamTimeoutError(Exception):
    pass


class UpstreamRateLimitError(Exception):
    pass


def parse_link(link):
    ydl_options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "extract_flat": False,
        "http_headers": {"User-Agent": USER_AGENT},
        "socket_timeout": int(os.getenv("YTDLP_SOCKET_TIMEOUT", "20")),
    }

    try:
        with YoutubeDL(ydl_options) as ydl:
            info = ydl.extract_info(link, download=False)
    except socket.timeout as exc:
        raise UpstreamTimeoutError(
            "The request timed out while fetching media details. Please try again."
        ) from exc
    except DownloadError as exc:
        raise map_download_error(exc) from exc
    except ExtractorError as exc:
        raise UnsupportedPlatformError(
            "This link could not be parsed by the current extractor."
        ) from exc

    entries = info.get("entries") if isinstance(info, dict) else None
    if isinstance(entries, list) and entries:
        info = next((entry for entry in entries if isinstance(entry, dict)), info)

    if not isinstance(info, dict):
        raise UnsupportedPlatformError("The parser could not read this link.")

    formats = build_formats(info)

    return {
        "success": True,
        "title": info.get("title") or "Video",
        "thumbnail": pick_thumbnail(info),
        "platform": detect_platform(link, info),
        "formats": formats,
    }


def build_formats(info):
    candidates = []
    seen = set()
    prefer_progressive = is_youtube_info(info)

    for fmt in info.get("formats", []) or []:
        normalized = normalize_format(fmt, prefer_progressive=prefer_progressive)
        if not normalized:
            continue

        key = (normalized["quality"], normalized["ext"], normalized["url"])
        if key in seen:
            continue

        seen.add(key)
        candidates.append(normalized)

    if not candidates:
        fallback_url = info.get("url")
        if is_direct_media_url(fallback_url):
            ext = guess_extension(fallback_url) or info.get("ext") or "mp4"
            candidates.append(
                {
                    "url": fallback_url,
                    "quality": quality_label(
                        info.get("height"),
                        info.get("format_note"),
                        info.get("resolution"),
                    ),
                    "ext": ext,
                }
            )

    candidates.sort(key=format_sort_key)
    return candidates[:12]


def normalize_format(fmt, prefer_progressive=False):
    if not isinstance(fmt, dict):
        return None

    url = fmt.get("url")
    if not is_direct_media_url(url):
        return None

    protocol = (fmt.get("protocol") or "").lower()
    if protocol and protocol not in ALLOWED_PROTOCOLS:
        return None

    # Skip known manifest-only formats that Expo downloaders handle poorly.
    if any(token in url for token in (".m3u8", ".mpd")):
        return None

    vcodec = fmt.get("vcodec")
    acodec = fmt.get("acodec")
    if vcodec == "none":
        return None

    # Expo downloads are much more reliable when the stream already contains audio.
    if acodec == "none":
        return None

    ext = fmt.get("ext") or guess_extension(url) or "mp4"
    quality = quality_label(fmt.get("height"), fmt.get("format_note"), fmt.get("resolution"))

    return {
        "url": url,
        "quality": quality,
        "ext": ext,
        "preference": format_preference(fmt, ext, prefer_progressive),
    }


def format_sort_key(fmt):
    quality = fmt.get("quality", "")
    height = extract_height(quality)
    ext = fmt.get("ext", "")
    preference = fmt.get("preference", 99)
    return (preference, 0 if ext == "mp4" else 1, -height, quality)


def extract_height(quality):
    digits = "".join(ch for ch in quality if ch.isdigit())
    return int(digits) if digits else 0


def quality_label(height, format_note, resolution):
    if isinstance(height, int) and height > 0:
        return f"{height}p"
    if isinstance(resolution, str) and resolution:
        return resolution
    if isinstance(format_note, str) and format_note:
        return format_note
    return "Standard"


def pick_thumbnail(info):
    thumbnail = info.get("thumbnail")
    if thumbnail:
        return thumbnail

    thumbnails = info.get("thumbnails") or []
    for item in reversed(thumbnails):
        if isinstance(item, dict) and item.get("url"):
            return item["url"]

    return None


def detect_platform(link, info):
    extractor = (info.get("extractor_key") or info.get("extractor") or "").lower()
    for key, label in PLATFORM_LABELS.items():
        if key in extractor:
            return label

    hostname = urlparse(link).hostname or ""
    hostname = hostname.lower()
    for key, label in PLATFORM_LABELS.items():
        if key in hostname:
            return label

    return "Video"


def is_youtube_info(info):
    extractor = (info.get("extractor_key") or info.get("extractor") or "").lower()
    return any(host in extractor for host in YOUTUBE_HOST_PARTS)


def format_preference(fmt, ext, prefer_progressive):
    if not prefer_progressive:
        return 0 if ext == "mp4" else 1

    protocol = (fmt.get("protocol") or "").lower()
    format_id = str(fmt.get("format_id") or "")
    note = str(fmt.get("format_note") or "").lower()
    is_progressive = protocol in ALLOWED_PROTOCOLS and fmt.get("acodec") not in (None, "none")

    if ext == "mp4" and is_progressive and "dash" not in note and "dash" not in format_id:
        return 0
    if ext == "mp4":
        return 1
    return 2


def map_download_error(error):
    message = str(error).lower()

    if "timed out" in message or "timeout" in message:
        return UpstreamTimeoutError(
            "The request timed out while fetching media details. Please try again."
        )
    if "429" in message or "too many requests" in message:
        return UpstreamRateLimitError(
            "The video site is rate-limiting requests right now. Please try again later."
        )
    if "unsupported url" in message or "unsupported" in message:
        return UnsupportedPlatformError(
            "This link is not supported yet by the current parser."
        )
    if "private video" in message or "login required" in message:
        return UnsupportedPlatformError(
            "This video is private or requires login, so it cannot be fetched here."
        )

    return UnsupportedPlatformError(
        "The parser could not extract media details from this link."
    )


def is_http_url(link):
    try:
        parsed = urlparse(link)
    except ValueError:
        return False

    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def is_direct_media_url(url):
    if not is_http_url(url):
        return False
    parsed = urlparse(url)
    return parsed.scheme in ALLOWED_PROTOCOLS


def guess_extension(url):
    path = urlparse(url).path or ""
    if "." not in path:
        return None
    return path.rsplit(".", 1)[-1].lower()


def strip_internal_fields(payload):
    if not isinstance(payload, dict):
        return payload

    cleaned = dict(payload)
    formats = []
    for fmt in cleaned.get("formats", []) or []:
        if not isinstance(fmt, dict):
            continue
        fmt_copy = dict(fmt)
        fmt_copy.pop("preference", None)
        formats.append(fmt_copy)
    cleaned["formats"] = formats
    return cleaned
