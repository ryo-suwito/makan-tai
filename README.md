# AI Image + Voice Studio

Local Next.js studio for three one-way workflows:

- Generate images from prompts with OpenAI-compatible image models or A2E
- Generate voice previews and saved WAV files from prompts with Cartesia
- Generate prompt text with Gemini or OpenRouter, then push the result into either the image or voice workflow

The app is intentionally simple: no auth, no multi-user sessions, no chat memory. Prompts and system prompts are stored in SQLite, and generated assets are stored on local disk under `public/`.

## What It Does

### 1. Image workflow

- Write and save image prompts
- Generate with:
  - `gpt-image-2`
  - `gpt-image-1.5`
  - `gpt-image-1`
  - `gpt-image-1-mini`
  - `gemini-2.5-flash-image`
  - `a2e`
- Pick quality, resolution, and batch size
- Reuse reference images from:
  - files selected in the browser
  - previously generated images
  - images already present in `public/uploads`
- Persist generated images locally in `public/generated`
- Show a rough per-run image cost estimate from `lib/cost.ts`
- Map Gemini image requests to supported aspect ratios instead of exact pixel sizes

### 2. Voice workflow

- Write a separate voice prompt unrelated to image generation
- Load only your owned Cartesia voices into the UI
- Preview speech in realtime through Cartesia WebSocket TTS
- Generate a saved WAV render on the server
- Store saved audio in `public/generated-audio`
- Keep sidecar JSON metadata for each saved audio file so the UI can show:
  - prompt preview
  - voice name
  - created timestamp

### 3. Text workflow

- Save named system prompts to SQLite
- Pick one saved system prompt per run
- Send one one-shot request to either:
  - Gemini Direct
  - OpenRouter
- No session continuation and no multi-turn chat state
- Apply generated output directly to:
  - the image prompt
  - the voice prompt
- Use `openrouter/free` or any live OpenRouter model slug for vendor-flexible text generation

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- `better-sqlite3` for prompt storage
- `axios` for HTTP calls
- `@cartesia/cartesia-js` for TTS
- `@google/genai` for Gemini

## Project Structure

```text
app/
  api/
    audio/route.ts
    cartesia/
      generate/route.ts
      token/route.ts
      voices/route.ts
    gemini/
      generate/route.ts
    openrouter/
      generate/route.ts
      models/route.ts
    generate/route.ts
    images/route.ts
    prompts/route.ts
    system-prompts/route.ts
  globals.css
  layout.tsx
  page.tsx
data/
  database.sqlite
lib/
  cost.ts
  db.ts
public/
  generated/
  generated-audio/
  uploads/
```

## Requirements

- Node.js 18+ recommended
- `npm`
- API keys for the providers you want to use

You do not need every provider configured if you only plan to use part of the app, but the related routes will fail until their env vars are present.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file:

```bash
cp .env.example .env.local
```

3. Fill in the keys you need in `.env.local`

4. Start the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Environment Variables

The app ships with `.env.example`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
CARTESIA_API_KEY=your_cartesia_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=AI Image + Voice Studio

A2E_API_KEY=your_a2e_api_key_here
A2E_API_BASE=https://video.a2e.ai/api/v1
SELF_HOST_INFERENCE_BASE=http://localhost:8000

DATABASE_PATH=./data/database.sqlite
```

### Variable notes

- `OPENAI_API_KEY`
  Required for the GPT Image models.
- `OPENAI_API_BASE`
  Defaults to `https://api.openai.com/v1`. You can point this at an OpenAI-compatible gateway if needed.
- `CARTESIA_API_KEY`
  Required for both realtime preview and saved WAV generation.
- `GEMINI_API_KEY`
  Required for the Gemini prompt writer.
- `OPENROUTER_API_KEY`
  Required for OpenRouter-backed text generation and model discovery.
- `OPENROUTER_SITE_URL`
  Optional. Sent as `HTTP-Referer` to OpenRouter for app attribution. Defaults to the current request origin.
- `OPENROUTER_APP_NAME`
  Optional. Sent as `X-OpenRouter-Title` for app attribution.
- `A2E_API_KEY`
  Required if you want to use the `a2e` image model option.
- `A2E_API_BASE`
  Defaults to `https://video.a2e.ai/api/v1`.
- `SELF_HOST_INFERENCE_BASE`
  Optional. Defaults to `http://localhost:8000` and is used when you pick the `Self-Host` vendor for image generation.
- `DATABASE_PATH`
  Defaults to `./data/database.sqlite`.

## Storage Model

### SQLite

The SQLite database is created lazily on first use by `lib/db.ts`.

Tables:

- `prompts`
  Stores saved image prompts shown in the sidebar.
- `system_prompts`
  Stores named Gemini system prompts.

### Files on Disk

- `public/generated`
  Local copies of generated image outputs
- `public/generated-audio`
  Saved Cartesia WAV renders plus `.json` metadata sidecars
- `public/uploads`
  Optional folder for manual reference images you want the UI to surface

## API Routes

### `POST /api/generate`

Generates images from the selected model.

- GPT Image requests are forwarded to `OPENAI_API_BASE/images/generations`
- Self-Host image requests are forwarded to `SELF_HOST_INFERENCE_BASE/api/generate`
- A2E requests are started and then polled until image URLs are available
- Returned image URLs are fetched and saved locally under `public/generated`

### `POST /api/fal/video`

Generates Fal video clips for workflow segments from an existing start image.

- Fal video requests are forwarded to `https://fal.run/...`
- Returned video URLs are fetched and saved locally under `public/generated-video`

### `GET /api/images`

Lists reusable images from:

- `public/uploads`
- `public/generated`

### `GET /api/prompts`

Returns saved image prompts.

### `POST /api/prompts`

Saves an image prompt.

### `DELETE /api/prompts?id=...`

Deletes a saved image prompt.

### `POST /api/cartesia/token`

Creates a short-lived Cartesia access token for browser-side realtime TTS preview.

### `GET /api/cartesia/voices`

Lists owned Cartesia voices only.

### `POST /api/cartesia/generate`

Generates a server-side WAV render with Cartesia and stores it in `public/generated-audio`.

### `GET /api/audio`

Lists saved audio clips and reads their sidecar metadata when available.

### `GET /api/system-prompts`

Returns saved Gemini system prompts.

### `POST /api/system-prompts`

Saves a named Gemini system prompt.

### `DELETE /api/system-prompts?id=...`

Deletes a saved Gemini system prompt.

### `POST /api/gemini/generate`

Runs a one-shot Gemini request.

### `GET /api/openrouter/models`

Returns text-capable OpenRouter models plus the built-in `openrouter/free` and `openrouter/auto` routers.

### `POST /api/openrouter/generate`

Runs a one-shot OpenRouter chat completion with the selected model slug and optional saved system prompt.

Request body:

```json
{
  "input": "Write a cinematic image prompt for ...",
  "systemPromptId": 1
}
```

Behavior:

- Loads the selected system prompt from SQLite when provided
- Sends a one-shot request with `gemini-3.5-flash`
- Returns plain generated text plus the model and selected system prompt name

## UI Notes

- The image prompt and voice prompt are separate on purpose.
- Gemini and OpenRouter are prompt-writing utilities, not a conversation layer.
- Cartesia preview is streamed live in the browser.
- Cartesia saved audio is generated by the Next.js server and written to disk.
- The saved audio list is scrollable so it can handle a larger library.
- Saved audio titles use the first chunk of the prompt instead of a generic filename.

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Known Behavior

- Remote image URLs returned by providers can expire. This app copies generated images into `public/generated` to keep them reusable.
- `public/uploads` is read-only from the app right now. If you want files there, add them manually.
- The project has no auth layer. Treat it as a local or trusted-environment tool unless you add access control.
- If Next.js dev output gets into a stale state, deleting `.next` and restarting `npm run dev` usually fixes it.

## Development Notes

- Main UI: `app/page.tsx`
- Styling: `app/globals.css`
- SQLite helpers: `lib/db.ts`
- Cost estimator: `lib/cost.ts`

If you want to extend the app, the clean next steps are usually:

- add auth
- move file metadata into SQLite instead of sidecar JSON
- add upload persistence for `public/uploads`
- add tagging/search for saved prompts, system prompts, and audio clips
