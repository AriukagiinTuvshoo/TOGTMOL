# Supabase + Vercel deployment

The project runs locally without credentials. These steps configure a real deployment. Source repository: [AriukagiinTuvshoo/TOGTMOL](https://github.com/AriukagiinTuvshoo/TOGTMOL). No hosted Supabase project has been modified.

## 1. Prepare the repository

Clone `https://github.com/AriukagiinTuvshoo/TOGTMOL.git` and use Node.js 24. Keep `package-lock.json`. Do not commit local credentials or generated dependency/build directories.

```bash
npm ci
npm run check
```

The included GitHub Actions workflow runs the same gates on pushes and pull requests.

For Cloudflare/OpenNext deployment, use `npm run build:worker`. The normal `npm run build` script runs the standard Next.js build and then generates the PWA precache manifest/service worker; the worker build does the same after OpenNext finishes. Keeping these commands separate prevents OpenNext from recursively invoking the package's own `build` script.

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

### Production Supabase smoke test

The current TOGTMOL architecture does **not** require `SUPABASE_SERVICE_ROLE_KEY` for normal authentication, RLS-protected sync, cloud deletion, or the Bondook quota RPC. The database functions validate `auth.uid()` and grant access to authenticated users; a service-role key must not be exposed to the browser. Keep any admin-only secret out of `NEXT_PUBLIC_*` variables and do not add it just to make the normal user flow work.

For a real production-account check, create a dedicated test account in the selected Supabase project, confirm its email when required, then run:

```bash
SUPABASE_PRODUCTION_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_PRODUCTION_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY \
SUPABASE_TEST_EMAIL=your-test@example.com \
SUPABASE_TEST_PASSWORD='use-a-dedicated-test-password' \
SUPABASE_EXPECTED_PROJECT_REF=YOUR_PROJECT \
SUPABASE_REQUIRE_CONFIRMED_EMAIL=1 \
npm run verify:supabase:production
```

The smoke test signs in, verifies the authenticated user, performs an RLS-protected `study_profiles` read, calls `pull_study_data`, and confirms the returned snapshot is schema version 5. It does not create, update, or delete study data and does not consume the Bondook quota. Run it against a dedicated test account, not a personal account.


### Legal pages for store release

The public legal pages are available at `/privacy` and `/terms`. The app footer links to both pages so users can reach them from the product itself.

Before App Store or Google Play submission, configure `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` to the support/privacy contact that should appear on those pages. Do not leave the fallback release note text in a public store submission.

## 4. Validate the real deployment

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
