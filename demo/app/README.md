# Quietly demo

This is a fully offline, vanilla HTML/CSS/JavaScript hackathon demo. It uses the bundled `data/day.json`; no API key, build step, account, or network request is required beyond loading local files from the development server.

## Run

```bash
cd demo/app
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

The demo starts with a small onboarding screen. `Today it saw…` exposes the source moments for the cards and lets the presenter delete one; regenerate the cards to show that only remaining observed moments can be praised.
