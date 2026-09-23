# Mobile device QA checklist

This checklist is for real-device validation before TestFlight or Google Play Internal testing. GitHub CI verifies the native project configuration and an Android debug build; it does not replace device, account, store, or production-Supabase testing.

## 0. Test setup

Use:

- one physical iPhone
- one physical Android device
- a production web origin set through `CAPACITOR_SERVER_URL`
- a production Supabase project with `togtmol://auth/callback` added to the Auth redirect allowlist
- two separate test accounts when checking cloud-data isolation

Record the app build/version, device OS version, test account, date, and result for each platform.

## 1. Authentication and deep links

| Test | Expected result |
| --- | --- |
| Email sign-up | Account creation completes without exposing a token in the URL. |
| Email confirmation | Confirmation link returns to the native app via `togtmol://auth/callback` and establishes the expected session. |
| Email sign-in | Existing user reaches the signed-in app state. |
| Password recovery | Recovery flow returns to the app and allows the password to be changed. |
| Google sign-in | Browser opens for OAuth, then the callback returns to the app and the session is established. |
| Cold-start deep link | Opening `togtmol://auth/callback` while the app is not running reaches the app and the callback is processed. |
| Background deep link | Opening the callback while the app is backgrounded returns to the existing app instance and processes the callback. |

Do not paste access or refresh tokens into the callback URL. The native bridge is expected to exchange the PKCE authorization code inside the app.

## 2. Local data, sync, and isolation

| Test | Expected result |
| --- | --- |
| Create study data while offline | Data remains available locally after closing and reopening the app. |
| Reconnect and sync | The same account's data synchronizes after connectivity returns. |
| Account A → Account B | Account B cannot see Account A's cloud data. |
| Account B → Account A | Account A's local/cloud data remains isolated. |
| Cloud delete | The signed-in user's study data is removed from cloud storage and the app remains usable for a fresh session. |

Use separate test accounts rather than reusing the same account on both devices when checking isolation.

## 3. Runtime behavior

| Test | Expected result |
| --- | --- |
| Start/stop/reset study timer | Timer state behaves consistently across the intended app lifecycle. |
| Background/lock while timing | Timer behavior matches the product requirement after returning to the app. |
| Reconnect after network loss | No unrecoverable error state; sync/auth can recover. |
| YouTube source playback | Official player/source opens and playback works on supported content. |
| Keyboard/form input | Inputs remain visible and usable when the soft keyboard appears. |
| Safe areas | Content is not obscured by the notch, status bar, navigation area, or home indicator. |
| Small/large screens | Primary flows remain usable without clipped controls or horizontal overflow. |

## 4. Legal and account controls

Verify that the native wrapper can open:

- `/privacy`
- `/terms`
- account settings
- cloud-data deletion controls

Check that contact/support information shown in the legal pages is the intended production information before store submission.

## 5. Evidence

For each platform, keep:

- build/version identifier
- device model and OS version
- test account identifier (never its password)
- pass/fail result for each section
- screenshots or screen recordings only when they help reproduce a failure
- exact error text and reproduction steps for failures

Do not commit credentials, signing files, provisioning profiles, keystores, or access/refresh tokens to Git.
