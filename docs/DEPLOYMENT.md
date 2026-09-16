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

v4.1 reuses the v4 JSON payload and needs no additional SQL migration if both existing migrations are applied. Apply both versioned migrations, in filename order, in `supabase/migrations/`. For an existing v3 database apply only `20260915131805_study_world_v4.sql`. Apply them through the SQL editor of the selected project, or use the installed Supabase CLI. Inspect `supabase --help`, `supabase link --help` and `supabase db push --help` before your installed version's commands. Confirm the target project and inspect the migration before applying it. Do not use a production project to run tests.

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

## 4. Validate the real deployment

Use two test accounts and two browser profiles/devices:

- Create local history; sign up; confirm email; sign in and explicitly merge guest history.
- Sign out; verify guest history is separate. Sign into the other account and verify isolation.
- Sign in with Google; refresh the callback; test password recovery.
- Create/edit/delete a session on one device, then sync the second. Make conflicting edits offline and choose the intended conflict version after reconnecting.
- Start/pause/resume a timer, navigate away, close/reopen, finish/review/save. Confirm the original start and duration.
- Check 320, 375, 390, 430, 768, 1024 and 1440 px layouts, keyboard focus, dialog Escape, long subject names and all five design themes plus light/dark preferences.
- Install the PWA; wait for the worker to finish installing; disable the network; navigate and save study data; reconnect and sync.
- Deploy a second build while a timer is open. Confirm no forced reload, then close tabs and reopen to adopt the update.

In Supabase, run security/performance advisors after applying the migration and investigate any project-specific findings. The delivered PGlite tests validate the schema's RLS and transaction semantics; they do not substitute for hosted configuration validation.

## 5. Optional online Togi

Local insights need no AI service. To enable the optional paid provider, configure **server-only** `OPENAI_API_KEY`, `OPENAI_MODEL` (a Responses API text model available to your account), and `TOGI_AI_ALLOWED_USER_IDS` (comma-separated allowed Supabase user UUIDs). All must be present. Never prefix them with `NEXT_PUBLIC_`. This release does not pick a paid model or provision credentials automatically.

The `/api/togi` route verifies the user's Supabase access token, requires the server allowlist and consumes an atomic per-user 20/day UTC quota in `private.togi_usage` before calling the provider. Anonymous requests cannot spend provider credit. Failed upstream requests still count toward the daily cap. This quota does not replace the provider account's own spending limits.

Users explicitly enable online mode. The app sends their question and limited study totals, subject names and goal titles, with session notes excluded by default. A separate opt-in can include the five latest notes from the last seven days (up to 500 characters each). Responses use `store:false`; no conversation database is created. No provider response can mutate study records. The key, raw upstream errors, and auth token are never returned to the browser.

On the real deployment, test an allowed account, a denied account, no token, offline/error fallback, and a provider request. The delivered tests use fake credentials and a mocked provider; no paid request has been made.

## 6. Music and YouTube

Seven original browser soundscapes are included in the production assets and require no external music host. Playback always needs a user action. YouTube code is loaded only after selecting a user-added YouTube source in the open music panel; YouTube assets are not cached by the service worker. A visible official player with controls is retained across app views. Minimizing, hiding the tab or scrolling the player off-screen pauses playback. Do not add hidden YouTube audio, ad blocking or downloads.

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
