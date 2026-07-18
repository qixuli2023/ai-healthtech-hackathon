# Quietly demo

This is a vanilla HTML/CSS/JavaScript hackathon demo. It can run fully offline with the bundled `data/day.json`, or analyse an uploaded vlog with Runware when a local API key is configured.

## Run

For the offline mock:

```bash
cd demo/app
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). The rest of the demo works, but vlog analysis is unavailable.

For Runware vlog analysis, create a root `.env` file containing `RUNWARE_API_KEY=...`. From the repository root, run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `Upload vlog` sends a video to the local API, which uploads it temporarily to Runware, builds a visual-only clip-relative timeline, then requests deletion of the temporary media. Companion chat also uses Runware for a short, session-only text conversation; if it cannot connect, it shows the bundled scripted demo exchange instead.

The demo starts with a small onboarding screen. `Today I saw…` exposes the source moments for the cards and lets the presenter delete one; regenerate the cards to show that only remaining observed moments can be praised.
