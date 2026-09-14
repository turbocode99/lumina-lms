# Brand film pipeline

Everything needed to regenerate `lumina-walkthrough.mp4` from a clone. The
rendered video and the full-resolution stills are deliberately **not** committed —
they are 100 MB of regenerable output, and git keeps binaries permanently. This
directory is how you get them back.

## What each file does

| File | |
|---|---|
| `scenes.mjs` | The cut. Scene order, durations, screens, on-screen copy, narration. Edit this first — everything else reads from it |
| `capture-light.mjs` | Drives the running app with Playwright and writes the 31 screens into `../shots` and `../shots-web` |
| `render.mjs` | Turns the stills into the film: Ken Burns, crossfades, burned-in titles, brand cards, music |
| `music.mjs` | Generates the music bed as a WAV. A placeholder, not a licensed track |
| `voice.mjs` | Optional narration through OpenAI or Gemini TTS |

## Prerequisites

The pipeline is not wired into the app's own dependencies, because nothing at
runtime needs a browser driver or a video encoder. Install them where you run it:

```bash
npm install --no-save playwright ffmpeg-static && npx playwright install chromium
```

Rendering also needs two fonts, which ship with Windows: Georgia for the titles
and Arial for the supporting lines. On macOS or Linux, change `SERIF`, `SERIF_B`,
`SANS_B` and `SANS` at the top of `render.mjs` to paths that exist there.

## Capturing the screens

Needs the app running with the demo dataset, because the film shows real seeded
people — Priya administers and Daniel learns, and the narration uses their names.

```bash
npm run build && npm start
```

Then, with tours already dismissed for both demo accounts so no overlay lands in
a frame:

```bash
node marketing/pipeline/capture-light.mjs
```

Two things that will bite otherwise. Capture against the **production** build —
the dev server stamps an indicator into the corner of every frame. And if SSO is
configured in `.env`, the login page grows a second submit button, which the
sign-in step will click by mistake.

## Rendering

```bash
node marketing/pipeline/render.mjs              # picture and music
node marketing/pipeline/render.mjs --limit 3    # first three scenes, for a quick look
```

Output lands in `../lumina-walkthrough.mp4` at 1920×1080. Intermediates go to a
temp directory, not the repo.

## Narration

Browser speech is not good enough for this; the storyboard page uses it only so
the pacing can be heard. For a real read, either record the clean script in
`../brand-video-script.md` with a voice artist, or generate it:

```bash
OPENAI_API_KEY=... node marketing/pipeline/voice.mjs      # nova, warm and measured
GEMINI_API_KEY=... node marketing/pipeline/voice.mjs --engine gemini
node marketing/pipeline/render.mjs --vo
```

`--vo` mixes one file per scene under the picture and ducks the music beneath it
with a sidechain compressor.

## Still outstanding

Scene 25 wants a terminal running `docker compose up` cut in alongside the SSO
screen. It was never captured because Docker was not installed on the machine the
film was made on.
