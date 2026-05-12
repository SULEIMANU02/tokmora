from http.server import BaseHTTPRequestHandler
import json


HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        for key, value in HEADERS.items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        for key, value in HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
        payload = {
            "ok": True,
            "service": "tokmora-python-parse",
            "endpoints": ["GET /api", "POST /api/parse/"],
        }
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def log_message(self, format, *args):
        return
