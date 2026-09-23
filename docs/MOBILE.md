# Mobile release plan

## Current state

Тогтмолийн web/PWA app нь Next.js + Supabase дээр үндэслэсэн хэвээр. `mobile/` folder нь Capacitor 8 native shell-ийн тусдаа workspace.

Capacitor dependencies are pinned to the verified stable 8.5.2 line, with Splash Screen 8.0.2. Capacitor 9 is still an alpha line at the time this setup was prepared, so the mobile wrapper does not follow the alpha line.

## Phase 1 — wrapper

- App ID: `com.togtmol.study`
- App name: `Тогтмол`
- Production web origin is supplied with `CAPACITOR_SERVER_URL`.
- Local fallback is `mobile/www/index.html`.
- No native signing credentials are stored in the repository.

## Phase 2 — authentication

The current web implementation uses PKCE and redirects to `window.location.origin`. Before TestFlight/Internal testing, native OAuth/email callbacks need a Capacitor deep-link bridge and Supabase redirect allowlist for the native scheme.

Recommended callback:

`togtmol://auth/callback`

The native browser/OAuth bridge should exchange the PKCE code for the Supabase session and then return to the app without putting tokens in a URL.

## Phase 3 — device QA

Verify on real devices:

- email signup/confirmation/login/recovery
- Google login
- local data and sync isolation
- offline storage and reconnect
- timer/wake-lock behavior
- YouTube playback
- privacy export and cloud deletion
- legal pages
- keyboard, safe areas, status/navigation bars and screen sizes

## Phase 4 — store release

iOS:
- Apple Developer signing/team
- bundle identifier reservation
- App Store privacy questionnaire
- TestFlight build
- screenshots and metadata
- Privacy Policy URL and support/contact URL

Android:
- Play Console app registration
- package name reservation
- Play App Signing
- Internal testing
- Data Safety form
- Privacy Policy URL and support/contact URL

No Apple/Google signing material belongs in Git.
