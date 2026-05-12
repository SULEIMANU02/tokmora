# Tokmora Render Backend

This repo now includes a Render-ready Python web service for YouTube parsing.

## Files

- `render_app.py`: Flask app for Render
- `render.yaml`: optional Render blueprint config
- `requirements.txt`: Python dependencies

## Manual Render setup

1. Push the repo to GitHub.
2. In Render, click `New` -> `Web Service`.
3. Connect this repo.
4. Use these settings:
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn render_app:app`
   - Instance Type: `Free`
5. Deploy.

After deploy, your endpoint will be:

```text
https://<your-render-service>.onrender.com/api/parse/
```
