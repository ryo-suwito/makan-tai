# Next.js AI Image Generator UI and API Integration

## Cost calculation background

The OpenAI image-generation guide explains that the **total cost** of an image request depends on the input text tokens, input image tokens (for edits), and image output tokens【388166028722929†L2824-L2835】.  The guide includes a table of per‑image prices for the GPT‑Image families at common resolutions and quality settings.  For example, GPT Image 2 charges **$0.006** per image at **1024×1024** resolution in low quality, **$0.053** at medium quality, and **$0.211** at high quality【388166028722929†L2846-L2851】.  Older models cost a bit more: GPT Image 1.5 costs **$0.009–$0.2** per image depending on resolution and quality【388166028722929†L2852-L2856】, GPT Image 1 costs **$0.011–$0.25**【388166028722929†L2858-L2862】, and GPT Image 1 Mini costs **$0.005–$0.052**【388166028722929†L2864-L2868】.

These values were encoded in a TypeScript module (`lib/cost.ts`) so the UI can estimate costs before sending a request.  For non‑standard resolutions, the helper functions estimate cost proportional to the image area relative to **1024×1024**, which is roughly one megapixel.  The `estimateTotalCost` function multiplies the per‑image price by the batch size.  This “napkin math” gives users an approximate cost up front, without needing to consult the pricing table directly.

## Project structure

The app is built with **Next.js (app router)** and TypeScript.  Key files include:

- **`lib/cost.ts`** – defines the pricing table derived from the OpenAI documentation and exposes helpers to compute per‑image and total costs.
- **`lib/db.ts`** – wraps a **SQLite** database (using `better-sqlite3`) to store saved prompts.  It creates a `prompts` table on first use and exposes `savePrompt`, `getPrompts`, and `deletePrompt` functions.
- **API routes** in `app/api`:
  - **`prompts/route.ts`** – handles GET/POST/DELETE to list, add or remove saved prompts using the SQLite helpers.
  - **`generate/route.ts`** – proxies requests to the appropriate image provider.  If the model starts with `gpt-image`, it calls the OpenAI **image generation** endpoint using the `OPENAI_API_KEY`.  If the model is `a2e`, it calls the **A2E (Adam2Eve)** `userText2Image/start` endpoint with the bearer token and forwards parameters as shown in the sample request.  Errors are caught and returned as JSON.
  - **`images/route.ts`** – lists uploaded and generated images located under `public/uploads` and `public/generated` so the front‑end can display a gallery.

- **`app/page.tsx`** – the main UI.  It provides input fields for the **prompt**, **model selection** (GPT Image 2/1.5/1/1 Mini or A2E), **quality** radio buttons, **resolution** inputs with preset buttons, **batch size** selector, and an **image uploader** for reference images.  A collapsible sidebar lists saved prompts.  Users can save/clear the current prompt and click on a saved prompt to reuse it.  When they click **Generate**, the form posts to `/api/generate`; the response is parsed and displayed in a simple horizontal carousel.  Each thumbnail opens the full‑size image in a new tab.  The page also displays the estimated cost computed via `estimateTotalCost` from the cost module.

- **Configuration files**:
  - `package.json` lists dependencies (`next`, `react`, `better‑sqlite3`, `axios`) and scripts.
  - `next.config.js` configures remote images and enables React strict mode.
  - `.env.example` documents required environment variables (`OPENAI_API_KEY`, `A2E_API_KEY`, `DATABASE_PATH`), encouraging developers to place secrets in `.env.local`.
  - `tsconfig.json` sets up TypeScript and module path aliases.

## Usage and deployment

1. Copy `.env.example` to `.env.local` and set your **OpenAI** and **A2E** API keys and endpoints.
2. Install dependencies and run the development server:

   ```bash
   npm install
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.  You can enter a prompt, choose a model and quality, select a resolution or define custom dimensions, pick batch size, and optionally upload reference images.  The estimated cost will update automatically.  Click **Generate** to send the request and view the results in the carousel.  Use the **Save** button to remember a prompt; saved prompts appear in the collapsible sidebar and are persisted in SQLite.

4. Images returned by the API are not stored persistently by default.  To expose generated or uploaded images via the `images` endpoint, you can save them to the `public/generated` or `public/uploads` directories after creation or upload; the current code simply lists the contents of those folders.

## Extending the app

This basic implementation can serve as a foundation for a more polished image‑generation UI.  Future improvements could include:

* **Polling or streaming** results from the A2E provider, as their API returns a task ID rather than images immediately.
* **Pagination** or advanced galleries for better navigation of large batches.
* **Authentication** and per‑user prompt history.
* Integration with the **OpenAI streaming API** using `partial_images`, which incurs an additional cost per streamed image【388166028722929†L2870-L2873】.

This project demonstrates how to combine pricing information from official documentation with a modern web stack to deliver a user‑friendly AI image generator.