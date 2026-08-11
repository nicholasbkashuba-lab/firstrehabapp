# JARVIS — voice HUD

A single self-contained page. No build step, no dependencies, no external requests —
same house style as the clinic portal at the repo root.

- `index.html` — the whole front end (HUD, speech in, speech out, approvals, diagnostics)
- `vercel.json` — proxies `/api/*` to `jarvis-api` so the browser talks same-origin

Deployed to the Vercel project **`jarvis`** (team `thedesignofman`).
The backend lives in the separate **`jarvis-api`** project.

## What it does

**Speech out.** Tries `POST /api/say` first and plays whatever audio comes back. If that
route is missing or returns nothing playable, it falls back to the browser's
`speechSynthesis`, preferring a British male voice (Daniel → Google UK English Male →
Arthur → any `en-GB`). Long briefings are split at sentence boundaries, because several
engines silently truncate past ~250 characters.

**Speech in.** `SpeechRecognition` where it exists (Chrome, Edge). Two modes:

- *Push-to-talk* — hold the reactor, or hold **Space**. Always available.
- *Wake word* — optional, off by default. Continuous listening; fires on "Jarvis …" and
  takes the rest of the utterance as the command. Restarts itself when Chrome ends the
  session, which it does every minute or so.

Safari and iOS have no `SpeechRecognition`. There the caption says so plainly and typing
still works — it does not pretend to listen.

**Audio unlock.** Browsers refuse speech until a user gesture, so the page opens on an
ENGAGE screen and warms the speech engine inside that click.

**Panels.** Open Loops, Agenda, Systems, Content Pipeline, Ledger, Awaiting Approval.

**No invented data.** Every panel renders `no link` or `—` until the API returns something.
Nothing is stubbed, sampled, or filled with plausible-looking numbers.

**Diagnostics (◧).** Probes all five routes and shows status, content-type, and the first
220 bytes of each response, with a copy-to-clipboard report. This is the fast way to
reconcile the front end against whatever the API actually returns.

## Deployment protection

`jarvis-api` currently has **Vercel Authentication on for all non-custom domains**. While
that is true:

- the `vercel.json` rewrite fails — the server-to-server hop has no SSO cookie and gets
  Vercel's HTML login page back;
- a direct cross-origin call fails too, on both CORS and cookie scope.

The page detects that page and says so by name rather than reporting a vague 401. Three
ways out, cheapest first:

1. Turn off Vercel Authentication on `jarvis-api` — it already has its own `/api/login`.
2. Give `jarvis-api` a custom domain; SSO exempts those.
3. Move the API routes into the `jarvis` project so `/api/*` is genuinely same-origin.

## API contract

The client is deliberately tolerant — it accepts several key spellings per field, so an
API written to a near-miss of this shape still lights the HUD. Canonical form:

### `GET /api/brief`

Falls back to `POST` if `GET` returns 404/405.

```json
{
  "speech": "Good morning, sir. Three things want you before ten.",
  "loops": [
    { "who": "Cameron Orsi", "what": "SunDial launch date",
      "quote": "Are we still good for the 20th?", "age": "2 days cold", "severity": "high" }
  ],
  "agenda": [
    { "time": "07:00", "title": "Palm Beach Executives", "where": "Café Boulud", "soon": true }
  ],
  "systems": [
    { "name": "firstrehabapp", "status": "ok", "detail": "deployed 2h ago" }
  ],
  "content": { "runwayDays": 2, "scheduled": 6, "nextSlot": "today 5:00 PM", "channels": 8 },
  "ledger": {
    "currency": "USD", "cash": 18240,
    "obligations": [{ "name": "Payroll", "due": "Aug 15", "amount": 9800 }],
    "note": "Three obligations inside 72 hours."
  },
  "pending": [
    { "id": "p1", "title": "Reply to Cameron", "detail": "Confirms the 20th." }
  ]
}
```

Accepted alternates: `speech` ← `brief` / `summary` / `text` / `spoken`;
`loops` ← `openLoops` / `threads` / `waiting`; `agenda` ← `calendar` / `events`;
`systems` ← `status` / `health` / `deployments`; `content` ← `pipeline` / `social`;
`ledger` ← `money` / `finance` / `cash`. A payload nested one level under `data` is
unwrapped. A plain-text response is spoken as-is.

`status` values map to the dot colour by pattern: `ok|ready|healthy|green|up|passing`,
`warn|building|degraded|queued`, `err|fail|down|red|canceled`.

### `POST /api/chat`

Sends `{ message, text, prompt }` — all three, same string, so the route can read whichever
it expects. Reply is read from `reply` / `response` / `text` / `message` / `content` /
`output` / `answer` / `speech`. If the response also carries `loops`/`agenda`/`systems`,
the panels refresh from it.

### `POST /api/say`

Sends `{ text }`. Best: return `audio/mpeg` bytes. Also accepted: `{ audio }` or `{ url }`
as a data URI, an https URL, or bare base64. Anything else → browser speech.

### `GET /api/pending`, `POST /api/pending`

`GET` returns a bare array or `{ pending | approvals | queue | items }`.
`POST` sends `{ id, decision: "approve" | "reject", action, approved }`; on 404/405 it
retries `POST /api/pending/:id`.

### `POST /api/login`

Sends `{ password, passphrase, pin, token }`. Returns `{ token }` (or any of
`accessToken` / `jwt` / `session` / `key`). The token is stored in `localStorage` and sent
on every later call as **both** `Authorization: Bearer …` and `x-jarvis-token`.

Any route may answer `401`/`403` to trigger the passphrase prompt.

## Settings

Gear icon. Held in `localStorage` under `jarvis.cfg.v1`: API base URL (blank = same-origin
proxy), voice, rate, speak-replies, wake word, auto-refresh interval.

## Keyboard

| Key | Action |
|---|---|
| **Space** (hold) | push-to-talk |
| **Enter** | send typed command |
| **Esc** | close overlays, stop speech |

Spoken shortcuts handled locally, without a round trip: *stop* / *quiet* / *silence*,
and *brief* / *status* / *catch me up* / *where do things stand*.
