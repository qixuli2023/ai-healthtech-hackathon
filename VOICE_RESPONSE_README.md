# Voice responses for Companion

The Companion can remain text-input first while speaking each reply aloud. This is a small, useful enhancement for the hackathon demo: the user types, the existing Companion LLM writes a reply, and a text-to-speech model returns playable audio.

## Recommended model

Use Runware's `google:gemini@3.1-flash-tts` model. It is a dedicated text-to-speech model, invoked with an `audioInference` task. It uses the same Runware API key and account as the rest of the demo, but it is an additional inference call for each Companion reply.

The existing `google:gemini@3.5-flash` call should remain responsible for the Companion's reflective text. The TTS model should receive only the final Companion reply.

```text
Typed user message
  → Gemini 3.5 Flash writes a short Companion reply
  → Gemini 3.1 Flash TTS generates speech from that reply
  → Browser plays the returned audio
```

## Suggested request shape

```js
const [audio] = await client.run({
  taskType: 'audioInference',
  model: 'google:gemini@3.1-flash-tts',
  speech: {
    text: companionReply,
    language: 'en-GB',
    voices: [{ speaker: 'Companion', voice: 'Gacrux' }],
  },
});
```

The local server should expose a small endpoint such as `POST /api/companion-voice`. The browser can then create an `Audio` object from the returned URL and play it after rendering the Companion text bubble.

## Scope for this demo

- Keep text input; no speech recognition is needed.
- Keep the text bubble visible as the accessibility and reliability fallback.
- Add a mute / replay control before autoplaying audio.
- Do not send timeline events, conditions, cards, preferences, or other health data to TTS—only the Companion's generated reply.
- If TTS fails, leave the text chat working normally.

This gives the presentation a voice-first feel without making the core interaction or the demo dependent on audio.

## Source

Runware documents the model as `google:gemini@3.1-flash-tts`, supporting expressive speech and 70+ languages: https://runware.ai/docs/models/google-gemini-3-1-flash-tts/examples
