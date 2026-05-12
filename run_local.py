import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from api.parse import (
    JSON_HEADERS,
    UnsupportedPlatformError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
    is_http_url,
    parse_link,
    strip_internal_fields,
)


class LocalHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send_json(204, None)

    def do_GET(self):
        if self.path in ("/api", "/api/"):
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "tokmora-python-parse",
                    "endpoints": ["GET /api", "POST /api/parse/"],
                },
            )
            return

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

    def do_POST(self):
        if self.path not in ("/api/parse", "/api/parse/"):
            self._send_json(404, {"message": "Not found"})
            return

        body = self._read_json()
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

    def log_message(self, format, *args):
        return

    def _read_json(self):
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


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8000), LocalHandler)
    print("Local API running at http://0.0.0.0:8000")
    print("LAN access: http://192.168.0.4:8000")
    server.serve_forever()
