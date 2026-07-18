# Habit video analyser

Minimal Runware integration for a hackathon POC. A user uploads a short video and receives a description of the visible activity. The prompt deliberately ignores speech and avoids medical conclusions.

## Run locally

1. Copy `.env.example` to `.env` and put in your Runware API key.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

The server uploads the selected video to Runware media storage, asks `google:gemini@3.5-flash` for a visual-only description, then requests deletion of the temporary upload.

## Video upload requirements

- Keep videos below 30 MB; this is the maximum accepted by the analysis provider.
- For a reliable demo, compress the clip to roughly 11,000 KB (about 11 MB) before uploading.
- Keep clips brief. This is not a medical device and should not be used with real patient footage.
