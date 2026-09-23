# Supabase + Vercel deployment

The project runs locally without credentials. These steps configure a real deployment. Source repository: [AriukagiinTuvshoo/TOGTMOL](https://github.com/AriukagiinTuvshoo/TOGTMOL). No hosted Supabase project has been modified.

## 1. Prepare the repository

Clone `https://github.com/AriukagiinTuvshoo/TOGTMOL.git` and use Node.js 24. Keep `package-lock.json`. Do not commit local credentials or generated dependency/build directories.

```bash
npm ci
npm run check
```

The included GitHub Actions workflow runs the same gates on pushes and pull requests.

## 2. Configure a Supabase project

Use the intended development/staging project first. Obtain its Project URL and **publishable key** from the Supabase dashboard. Do not put a secret/service-role key in `NEXT_PUBLIC_*` variables.

v5 uses schema 5. Apply all three versioned migrations in filename order in `supabase/migrations/`. For an existing v4 database, apply only `20260921155351_knowledge_world_v5.sql`; an existing v3 database needs both the v4 and v5 migrations. Back up the hosted data and deploy the v5 client after the additive SQL migration. Old clients cannot upload after this schema change. Apply them through the SQL editor of the selected project, or use the installed Supabase CLI. Inspect `supabase --help`, `supabase link --help` and `supabase db push --help` before your installed version's commands. Confirm the target project and inspect the migration before applying it. Do not use a production project to run tests.

This schema is new. If the target project already has tables called `subjects`, `goals`, or the other included names, reconcile them in a separate migration first; do not drop existing tables.

Enable email authentication. Decide whether to require email confirmation; the UI handles the confirmation-email path. Enable Google Auth and configure the Google provider credentials and Supabase provider callback shown in that dashboard. Configure the app's production origin as **Site URL** and allow the exact development/staging/production redirect origins you use.

The app uses PKCE. Email confirmation, recovery, and Google redirect back to the app origin. The Supabase browser SDK handles the code exchange and URL cleanup. No secret is sent through application query parameters by this app.

For public release, configure reliable auth email delivery and review the project's auth rate limits. Test actual confirmation and recovery emails.

## 3. Configure local environment and Vercel

Copy `.env.example` to `.env.local` and supply:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Leave both empty for local-only operation. Restart/rebuild after changing these variables: Next public variables are embedded at build time.

Import the chosen repository in Vercel. Framework: **Next.js**. Install command: `npm ci`. Build command: **`npm run build`**. Node: **24.x**. Add both public environment values to the intended environment and deploy. The checked-in `vercel.json` selects the same commands.

Do not replace the build command with `next build` alone: the second step generates the offline manifest and service worker. Service worker scope is `/`; this release expects a root-domain deployment rather than a URL subdirectory.



## 4. Configure Render

Render should run the normal Next.js application, not the Cloudflare Worker bundle. The repository includes `render.yaml` as a version-controlled Blueprint reference.

For the existing Render Web Service, use these settings:

| Setting | Value |
| --- | --- |
| Runtime | **Node** |
| Branch | **main** |
| Root Directory | repository root / empty |
| Build Command | **`npm ci && npm run build`** |
| Start Command | **`npm start`** |
| Health Check Path | **`/api/health`** |
| Auto Deploy | **On Commit** |
| Node version | **24** |

The production `start` script explicitly binds Next.js to `0.0.0.0` so the service is reachable by Render's public web-service proxy. Render requires web services to listen on an externally reachable interface, and HTTP health checks succeed when the configured path returns a 2xx/3xx response. See Render's web-service and health-check documentation.

The new `/api/health` endpoint does not require Supabase or AI credentials and reports the Render commit when Render provides `RENDER_GIT_COMMIT`. This keeps optional integrations from making the web process look unhealthy.

**Important:** an existing Render service does not automatically adopt every field in `render.yaml` just because the file exists. Update the existing service's **Settings** to match the table above. Then use **Manual Deploy → Clear build cache & deploy** once after changing the build command or when stale generated/static assets may be involved.

Do not use a Cloudflare command on Render. In particular, do not set the Render build/start commands to `wrangler deploy`, `npx wrangler deploy`, `npx @opennextjs/cloudflare build`, or a `.open-next/worker.js` start command. Render serves the standard Next.js server here. The Cloudflare Worker configuration remains in `wrangler.jsonc` for the separate Cloudflare deployment path.

If the Render service is connected to GitHub, keep **Auto-Deploy = On Commit** so pushes to `main` trigger a new deploy. If a deploy fails, Render keeps the last healthy deployment serving traffic until a later deploy succeeds.

## 5. Validate the real deployment

For Render specifically, verify that the build completes, the start process stays running, `GET /api/health` returns JSON with `"ok": true`, the instance becomes healthy, the home page and static assets load, and a second push to `main` creates a new deploy.

## 6. Validate the real deployment

Use two test accounts and two browser profiles/devices:

- Create local history; sign up; confirm email; sign in and explicitly merge guest history.
- Sign out; verify guest history is separate. Sign into the other account and verify isolation.
- Sign in with Google; refresh the callback; test password recovery.
- Create/edit/delete a session on one device, then sync the second. Make conflicting edits offline and choose the intended conflict version after reconnecting.
- Start/pause/resume a timer, navigate away, close/reopen, finish/review/save. Confirm the original start and duration.
- Check 320, 375, 390, 430, 768, 1024 and 1440 px layouts, keyboard focus, dialog Escape, long subject names and all ten design themes plus light/dark preferences.
- Install the PWA; wait for the worker to finish installing; disable the network; navigate and save study data; reconnect and sync.
- Deploy a second build while a timer is open. Confirm no forced reload, then close tabs and reopen to adopt the update.

In Supabase, run security/performance advisors after applying the migration and investigate any project-specific findings. The delivered PGlite tests validate the schema's RLS and transaction semantics; they do not substitute for hosted configuration validation.

## 5. Optional online Bondook

Local insights need no AI service. To enable the optional paid provider, configure **server-only** `OPENAI_API_KEY`, `OPENAI_MODEL` (a Responses API model available to your account; card images additionally require image input and structured-output support), and `BONDOOK_AI_ALLOWED_USER_IDS` (comma-separated allowed Supabase user UUIDs). All must be present. Never prefix them with `NEXT_PUBLIC_`. This release does not pick a paid model or provision credentials automatically.

The `/api/bondook`, `/api/bondook/cards` and `/api/bondook/plan` routes verify the user's Supabase access token, require the server allowlist and consume an atomic per-user 20/day UTC quota in `private.togi_usage` before calling the provider. Anonymous requests cannot spend provider credit. Failed upstream requests still count toward the daily cap. This quota does not replace the provider account's own spending limits.

Users explicitly enable online mode. The app sends their question and limited study totals, subject names and goal titles, with session notes excluded by default. A separate opt-in can include the five latest notes from the last seven days (up to 500 characters each). Responses use `store:false`. Chat messages are saved in the user’s local document and included in an enabled cloud sync and exports. General questions send no unrelated study history. Card generation sends only the selected text and separately opted-in image; plan generation sends the goal, selected subject and available time. Structured proposals are validated and shown for editing before a user commits any cards or plan. No provider response can mutate study records. The legacy `/api/togi`, allowlist environment name and quota RPC remain compatible with existing installations; all current UI uses Bondook. The key, raw upstream errors, and auth token are never returned to the browser.

On the real deployment, test an allowed account, a denied account, no token, offline/error fallback, and a provider request. The delivered tests use fake credentials and a mocked provider; no paid request has been made.

## 6. Cloud erasure and stale devices

The Privacy screen requires a typed confirmation, disables sync, saves a local backup of the remote snapshot, then calls `delete_cloud_study_data` with the current user and cloud revision. The RPC removes that user’s study rows while retaining the auth account and a minimal revision/reset-epoch marker. Other devices must explicitly acknowledge that epoch before re-uploading old local history. Existing devices keep their local copies and backups; this is not a remote wipe of every device.

Test this with two accounts and two devices. Also verify that disabling sync prevents subsequent uploads and that local/account recovery targets the correct namespace.

## 7. Music and YouTube

Nine original browser soundscapes are included in the production assets and require no external music host. Playback always needs a user action. YouTube code is loaded only after selecting a user-added YouTube source in the open music panel; YouTube assets are not cached by the service worker. One official player with controls is retained across app views and expand/minimize changes. The floating mini-player keeps the video visible (at least 200 × 200 px), with Play/Pause, Volume, Expand and Stop. The app does not call pause on visibility or intersection changes. Browser/OS/YouTube behavior may still suspend playback in the background or on screen lock. Media Session play/pause/next/previous/stop handlers are registered where supported; they do not grant background playback or bypass iframe restrictions. See [the music-only fix and verification](MUSIC.md). Do not add hidden YouTube audio, ad blocking or downloads.

Test a real video and playlist on the deployed origin, including autoplay blocking, unavailable/embedding-disabled videos, volume, previous/next and mobile tap behavior. Preserve `Referrer-Policy: strict-origin-when-cross-origin`; YouTube needs origin identification.

## Reference documentation

- Next installation: https://nextjs.org/docs/app/getting-started/installation
- Next PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Google authentication: https://supabase.com/docs/guides/auth/social-login/auth-google
- Explicit API grants change: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

- GitHub checkout action: https://github.com/actions/checkout
- GitHub Node setup action: https://github.com/actions/setup-node

- [Official YouTube iframe API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI authentication](https://developers.openai.com/api/reference/overview/)

- [SM-2 algorithm](https://super-memory.com/english/ol/sm2.htm)
- [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
