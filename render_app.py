from flask import Flask, jsonify, request

from api.parse_handler import (
    UnsupportedPlatformError,
    UpstreamRateLimitError,
    UpstreamTimeoutError,
    is_http_url,
    parse_link,
    strip_internal_fields,
)


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@app.route("/api", methods=["GET", "OPTIONS"])
def api_root():
    if request.method == "OPTIONS":
        return ("", 204)

    return jsonify(
        {
            "ok": True,
            "service": "tokmora-python-parse",
            "endpoints": ["GET /api", "POST /api/parse/"],
        }
    )


@app.route("/api/parse", methods=["GET", "POST", "OPTIONS"])
@app.route("/api/parse/", methods=["GET", "POST", "OPTIONS"])
def parse_route():
    if request.method == "OPTIONS":
        return ("", 204)

    if request.method == "GET":
        return jsonify(
            {
                "ok": True,
                "service": "tokmora-python-parse",
                "endpoint": "POST /api/parse/",
            }
        )

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"message": "Invalid JSON body"}), 400

    link = body.get("link", "").strip() if isinstance(body, dict) else ""
    if not link:
        return jsonify({"message": "Missing link"}), 400

    if not is_http_url(link):
        return jsonify({"message": "Invalid link"}), 400

    try:
        payload = parse_link(link)
    except UnsupportedPlatformError as exc:
        return (
            jsonify(
                {
                    "message": str(exc),
                    "details": getattr(exc, "details", None),
                    "formats": [],
                }
            ),
            422,
        )
    except UpstreamTimeoutError as exc:
        return jsonify({"message": str(exc), "formats": []}), 504
    except UpstreamRateLimitError as exc:
        return jsonify({"message": str(exc), "formats": []}), 429
    except Exception:
        return (
            jsonify(
                {
                    "message": (
                        "Unable to process this link right now. "
                        "Please try again in a moment."
                    ),
                    "formats": [],
                }
            ),
            502,
        )

    if not payload["formats"]:
        return (
            jsonify(
                {
                    "message": "Couldn't find any downloadable media from this link",
                    "formats": [],
                }
            ),
            404,
        )

    return jsonify(strip_internal_fields(payload))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
