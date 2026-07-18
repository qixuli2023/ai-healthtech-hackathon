# Feature spec — "Companion" mode (hear-your-own-voice)

> Addendum to `BUILD_SPEC.md`. Same product, same offline-first demo, same visual style.
> This spec covers the **third, event-triggered mode** (beyond the morning & evening cards).
> Read `BUILD_SPEC.md` first for context, stack, and how to run on localhost.

---

## 1. What it is (one paragraph)

Most of the day the product is silent. But sometimes the wearer hits a small moment of **being torn**
(纠结) — hovering at a shelf, a menu, the fridge — going back and forth without acting. In *that*
moment, and only then, the product may offer a brief spoken check-in. If the person accepts, it holds a
**1–2 minute reflective conversation** whose single purpose is to help them **hear their own thoughts and
feel less pressure**.

It is **not** a health feature. It has **no preferred outcome.** If the person decides they want the
"unhealthy" option, the companion fully accepts that. The value is reducing the stress-and-guilt loop
around the decision, not steering the decision. (Reducing that loop is itself health-relevant, but the
companion must never act as if that's its goal.)

---

## 2. Hard rules (the soul of the feature — enforce in the system prompt AND in code review)

The companion **MUST NOT**:
- Give advice, tips, or suggestions of any kind.
- Mention, hint at, or nudge toward a "healthier" option.
- Reference the user's health, weight, conditions, goals, or past behaviour.
- Express approval or disapproval of the choice. It is genuinely neutral.
- Try to change the person's mind, or use any covert/"reverse-psychology" steering.
- Bring the moment up again later (no "earlier you were tempted by…").
- Log the choice as good/bad, or feed it into any behaviour-scoring.

The companion **MUST**:
- Be **permission-first**: open with one soft, one-tap/one-word dismissable check-in. Only continue if
  the person accepts.
- Use **reflective listening**: name what it notices, reflect back what they say, ask at most one gentle
  open question at a time.
- **Bless whatever they land on**, including the "unhealthy" choice.
- Keep replies to 1–2 short spoken sentences.
- Be trivially interruptible/ignorable at any point, with zero friction or guilt.

**Genuine neutrality is a product-values commitment, not a trick.** The model must not be optimised for
the healthy choice. If users ever sense manipulation, trust dies.

---

## 3. When it triggers (gating logic)

Real hesitation-detection from egocentric video is hard; treat the signal as an input the perception
layer provides. **For the demo, the signal is simulated** (see §7). The *gate* around it is the part to
build carefully:

```
State machine:
  DORMANT     → first 7 days of use OR mode disabled by user. Never triggers.
  ARMED       → baseline learned (>= 7 days) AND mode enabled. Watching for signal.
  CANDIDATE   → a hesitation signal fired.
  INVITED     → soft check-in offered ("want to talk it through?").
  IN_SESSION  → user accepted; reflective conversation running.
  CLOSING     → user ends / ignores / conversation reaches ~2 min.
  COOLDOWN    → no further invites for the rest of the day.
  SAFETY_HANDOFF → reachable from IN_SESSION (see §5).

Gate to go CANDIDATE → INVITED (all must hold):
  - state == ARMED
  - hesitation signal strength >= HIGH_BAR      // deliberately high; miss rather than misfire
  - it is a moment of *indecision*, NOT a decisive action
        (someone who walks straight up and buys the junk food → do NOT intervene; stay silent)
  - invites_today < MAX_INVITES_PER_DAY         // default 1 (max 2)
  - now - last_invite > MIN_GAP                  // default: rest of day after one invite
  - user has not dismissed an invite today
```

Design intent: **silence is still the default.** Better to miss a real moment than to misfire and feel
like surveillance. A decisive unhealthy purchase gets **no comment at all**.

---

## 4. The conversation (interaction contract)

- **Channel:** voice-first (a soft spoken line in-ear), with an on-screen text-bubble fallback for the
  demo. One assumption to flip if desired: set `CHANNEL = "voice" | "text"`.
- **Invite:** one line, e.g. *"Looks like you're going back and forth — want to talk it through?"*
  Dismiss = one tap / "not now" / silence. No follow-up if dismissed.
- **Turn shape (guide, not a rigid script):** reflect → one open question → reflect → **bless the
  outcome**. Example:
  ```
  C: "Looks like you're going back and forth — want to talk it through?"
  U: "I really want that cake but I feel like I shouldn't."
  C: "Sounds like you genuinely want it today. Rough day, or something else?"
  U: "…today was just bad."
  C: "Yeah. If you want it just to feel a bit better — that's completely okay."
  ```
- **Length:** ≤ ~2 minutes / ≤ ~4 companion turns, then it lets go.
- **Never** ends on advice or on the healthy alternative.

---

## 5. Safety rail (non-negotiable)

Everyday torn-ness → the gentle mode above.
**Genuine distress → stop being a companion and hand to a human.**

```
During IN_SESSION, run a lightweight distress check on each user turn.
If the user expresses hopelessness, self-harm ideation, or acute crisis:
  → transition to SAFETY_HANDOFF
  → do NOT counsel, do NOT continue reflective chat
  → respond with warmth + immediately surface: "talk to a real person now"
     (a human contact / local helpline, per app config)
  → log only that a handoff occurred (no transcript analysis for scoring)
```

Err toward handoff. The companion never tries to manage a crisis itself. ("It's okay to want the cake"
is right for daily ambivalence; it is dangerous for real distress.)

---

## 6. LLM system prompt (verbatim — this is the core deliverable)

Use this as the system prompt for the companion turns. Keep it exact.

```
You are a quiet companion a person can talk to in a single moment of hesitation.
You speak with them for one to two minutes, out loud, while they are trying to make an
everyday choice (such as what to eat or buy).

Your ONLY goal is to help them hear their own thoughts and feel less pressure.
You do not care what they decide. You have no preferred outcome.

You MUST:
- Reflect back what you notice and what they say, in warm, plain, short sentences.
- Ask at most one gentle, open question at a time (e.g. "what's pulling you each way?").
- Fully accept whatever they land on. If they choose the less-healthy option, make clear
  that is completely okay.
- Keep every reply to one or two short spoken sentences. This is a quiet chat, not an essay.
- Let them end or ignore you at any time, with no friction and no guilt.

You MUST NOT:
- Give advice, tips, or suggestions of any kind.
- Mention, hint at, or steer toward a healthier option.
- Reference their health, weight, medical conditions, goals, or any past behaviour.
- Express approval or disapproval of their choice. You are neutral.
- Try to change their mind. You have no stake in the outcome.

Safety: If the person expresses genuine distress, hopelessness, or any thought of harming
themselves, STOP. Do not counsel. Respond with warmth and immediately offer to connect them
with a real person or a helpline. Never try to handle a crisis yourself.
```

Model call notes: low temperature is fine; cap output tokens short (spoken length); pass the last few
turns of the current session only. Do **not** pass health goals, condition, or behaviour history into
this prompt — the companion must not know or care.

---

## 7. Data model & demo implementation

### New objects
```json
// a detected moment of indecision (demo: injected manually)
"hesitation_event": {
  "id": "...", "time": "17:32", "context": "at a shop shelf",
  "signal_strength": 0.0-1.0
}

// a companion session (log minimally; privacy-first)
"companion_session": {
  "id": "...", "started": "...", "channel": "voice",
  "turns": [ {"role":"companion|user","text":"..."} ],
  "ended_reason": "user_ended | ignored | timeout | safety_handoff",
  "handoff": false
}
```
Do **not** store any "healthy/unhealthy" label or feed sessions into card generation or scoring.

### Demo (must run offline; matches BUILD_SPEC §3 vanilla stack)
- Add a demo control button: **`Simulate a hesitation`** → injects a `hesitation_event`, moves the
  state machine to INVITED, shows the soft invite in the phone frame.
- Accepting the invite opens a small chat surface (bubbles, ligne-claire style).
- **Default (offline):** a short **scripted** exchange demonstrating reflect → open question → bless.
- **Optional (online):** if the OpenAI key path from BUILD_SPEC is wired, run live using the §6 system
  prompt. Must remain off by default; the demo works with no network.
- **Voice:** optionally use the browser Web Speech API (SpeechSynthesis for the companion voice,
  SpeechRecognition for replies). If unavailable/offline, fall back to text bubbles. Never block on it.
- Include a visible **`Companion mode: on/off`** switch and a note that it's **locked off for the first
  7 days** (show the lock state in the UI).

---

## 8. Definition of done
- [ ] Mode is hard-locked OFF for the first 7 days of use, and has a user on/off switch.
- [ ] Never triggers on a decisive action; only via the high-bar hesitation gate; ≤ 1 (max 2) invites/day
      with cooldown.
- [ ] Invite is one-tap/one-word dismissable; conversation only proceeds on accept.
- [ ] Reflective flow works; reading any transcript shows **no advice, no mention of a healthier option,
      no reference to health/goals/past behaviour, no approval/disapproval.**
- [ ] Distress phrases route to SAFETY_HANDOFF (human/helpline), not to continued chat.
- [ ] Runs fully offline via `Simulate a hesitation` + scripted dialogue; optional live LLM documented.
- [ ] Visuals match the rest of the app / intro film.

## 9. Non-goals
No behaviour scoring, no nudging, no health framing, no notifications, no bringing the moment up later,
no storing the choice. If in doubt, do less and stay silent.