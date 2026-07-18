# Feel Good

> An AI companion for staying the course.

Feel Good is a hackathon prototype for people living with obesity and other long-term conditions. It is built around a simple idea: people do not need more pressure or more information; they need support that makes everyday effort feel noticed and sustainable.

Rather than counting calories, tracking streaks, or issuing commands, Feel Good turns visible moments from a short life-vlog into gentle reflections and small, optional nudges.

## What it does

- **Morning card** — offers one small, no-pressure thought for the day.
- **Evening card** — reflects back positive, visible moments from the day without inventing achievements.
- **Today I saw…** — shows the visual timeline behind the cards and lets the user delete any moment they do not want used.
- **Companion** — provides a short, non-directive conversation space when a user feels stuck.
- **Video analysis** — converts an uploaded vlog into a visual-only activity timeline using Runware and Google Gemini.

## How it works

1. The user uploads a short vlog from the app.
2. The local Node.js server temporarily uploads it to Runware media storage.
3. Google Gemini analyses visible activity only and returns a concise timeline.
4. The app displays the source moments and uses only retained evidence to shape its reflections.
5. The server requests deletion of the temporary media after analysis.

The prototype deliberately ignores speech and avoids identifying people or drawing medical conclusions.

## Tech stack

- **Frontend:** Vanilla HTML, CSS, and JavaScript
- **Backend:** Node.js HTTP server with ES modules
- **AI and media analysis:** Runware SDK with Google Gemini 3.5 Flash
- **Configuration:** `dotenv` and a local `.env` file
- **Demo state:** Browser `localStorage`

## Run locally

### Prerequisites

- Node.js 18 or newer
- A Runware API key

### Setup

Create a `.env` file in the repository root:

```env
RUNWARE_API_KEY=your_runware_api_key
```

Then install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo flow

1. Complete or skip onboarding.
2. Switch between the Morning and Evening cards.
3. Open **today I saw…** to inspect the demo timeline.
4. Upload a short vlog to generate a visual activity timeline.
5. Delete a source moment to see that it is no longer used by the card.

## Video requirements

- Keep videos below **30 MB**; this is the analysis provider's maximum accepted size.
- For a reliable demo, compress clips to roughly **11,000 KB** (about 11 MB).
- Keep clips brief and use non-sensitive demonstration footage only.

## Product principles

- Be an honest mirror: never fabricate activity, duration, or progress.
- Keep support gentle, positive, and optional.
- Prefer silence over notification spam.
- Avoid guilt mechanics, calorie counting, biomarker dashboards, diagnoses, and medical advice.
- Treat the product as a consumer wellness prototype, **not a medical device**.

## Project notes

The full product concept and guardrails are in [product-requirement.md](product-requirement.md). The accompanying demo deck is available in [demo-deck.html](demo-deck.html).
