# Workout Tracker (Modular)

This is a static app with separate files (no huge single HTML).

## Why this works better
- Much easier to debug (JS errors won’t “hide” inside one giant file)
- GitHub Pages-friendly
- No service-worker caching surprises (unless you add one intentionally)

## IMPORTANT: local file vs server
This app uses ES Modules (`<script type="module">`). Most browsers **block module imports** when opened as `file://`.

### Run locally (recommended)
```bash
python3 -m http.server 8080
```
Then open:
http://localhost:8080

### Deploy
Upload these files to your repo and enable GitHub Pages.
