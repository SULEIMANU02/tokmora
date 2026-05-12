# Tokmora Python Backend

This replaces the old Heroku `POST /api/parse/` endpoint with a Python backend you can deploy on Vercel.

## What it does

- Exposes `POST /api/parse/`
- Accepts JSON like `{ "link": "https://..." }`
- Uses Python `yt-dlp` to resolve downloadable media URLs
- Returns the same shape your app already expects:

```json
{
  "success": true,
  "title": "Video title",
  "thumbnail": "https://...",
  "platform": "Instagram",
  "formats": [
    {
      "url": "https://...",
      "quality": "720p",
      "ext": "mp4"
    }
  ]
}
```

## Important behavior

- YouTube links are allowed, but only direct downloadable formats are returned.
- The backend filters out manifest-style formats like `m3u8` and `mpd` because your Expo download flow works better with direct file URLs.
- If a platform only exposes DRM or non-direct streams, the endpoint may return no formats.
- For YouTube specifically, the backend prefers progressive MP4 formats that already include audio, since those work best with Expo downloads.

## Files

- `api/index.py`: health endpoint for `/api`
- `api/parse.py`: main parser endpoint for `/api/parse/`
- `requirements.txt`: Python dependencies
- `vercel.json`: Vercel function config

## Deploy to Vercel

According to Vercel's Python runtime docs, Python functions in `api/*.py` are deployed automatically, and dependencies can be installed from `requirements.txt`:

- https://vercel.com/docs/functions/runtimes/python
- https://vercel.com/docs/functions/limitations/

Steps:

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Deploy.
4. After deploy, your endpoint will be:

```text
https://<your-project>.vercel.app/api/parse/
```

For better reliability on Hobby, set your function max duration in the Vercel dashboard to the highest allowed value for your plan. Vercel's current docs:

- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/functions/limitations

## Test locally without Vercel CLI

If `vercel dev` fails on Windows, use the included local runner instead:

```powershell
python run_local.py
```

Then test:

```powershell
curl http://127.0.0.1:8000/api
```

```powershell
curl -X POST http://127.0.0.1:8000/api/parse/ `
  -H "Content-Type: application/json" `
  -d "{\"link\":\"https://www.instagram.com/reel/your-link/\"}"
```

## App setup

Set this before starting Expo or building:

```powershell
$env:EXPO_PUBLIC_PARSE_API_BASE_URL="https://<your-project>.vercel.app"
```

Your app already builds the final request URL as:

```text
<EXPO_PUBLIC_PARSE_API_BASE_URL>/api/parse/
```
