# Cloudflare Workers deployment

TOGTMOL is a full Next.js application with server routes, authentication callbacks, and other runtime behavior. Its production Cloudflare target is **Cloudflare Workers with OpenNext**, not a static Cloudflare Pages site.

## Workers setup

Use the repository root as the build root.

- Node.js: **24**
- Install command: `npm ci`
- Build command: `npm run build:worker`
- Worker configuration: `wrangler.jsonc`
- Worker name: **`togtmol`**
- Worker entry: `.open-next/worker.js`
- Static asset directory: `.open-next/assets`

The checked-in `wrangler.jsonc` includes the OpenNext self-reference service binding:

```json
"services": [
  {
    "binding": "WORKER_SELF_REFERENCE",
    "service": "togtmol"
  }
]
```

The `service` name must match the Worker name exactly. A stale binding such as `togtmol-study-os` causes Cloudflare error 10143 because the referenced Worker does not exist under that name.

OpenNext also expects the `nodejs_compat` and `global_fetch_strictly_public` compatibility flags for the generated runtime.

For a local build/validation:

```bash
npm ci
npm run build:worker
npx wrangler deploy --dry-run
```

For an authenticated deployment from a trusted environment:

```npm run build:worker
npx wrangler deploy
```

Do not put Cloudflare API tokens in Git. Configure the token/account ID in the Cloudflare build environment or use Wrangler's supported login flow.

## Cloudflare Pages

Do **not** configure this repository as a static Cloudflare Pages project.

The app depends on Next.js runtime behavior and the OpenNext Worker output. A Pages project configured to upload `.next`, `.open-next`, or the repository root as a static directory is not equivalent to the Workers deployment and will fail or produce an incomplete application.

If an old Pages project is connected to this repository, disconnect that Pages deployment and use the Workers project named `togtmol` instead. Keeping both projects pointed at the same repository creates two different build targets with incompatible expectations.

## Supabase

The production browser origin remains the HTTPS URL exposed by the deployed Worker. Add that origin to Supabase Auth URL configuration as appropriate.

The native mobile callback remains:

```text
togtmol://auth/callback
```

That callback is separate from the Worker hostname and must be allowed by Supabase for native authentication.

## Common failure states

### Error 10143: Worker service binding not found

Check:

1. The deployed Worker is named `togtmol`.
2. `wrangler.jsonc` contains `WORKER_SELF_REFERENCE` with `service: "togtmol"`.
3. A dashboard binding does not still reference `togtmol-study-os`.
4. The Cloudflare project is a Workers deployment, not a Pages static deployment.

### Build command recursively calls itself

Do not use OpenNext as the package's main `build` script. This repository keeps:

- `npm run build` → normal Next.js/PWA build
- `npm run build:worker` → OpenNext Cloudflare Worker build

This prevents OpenNext from recursively invoking `npm run build`.

### Wrong output directory

Do not point a Workers deployment at `out` or `.next`. OpenNext generates:

- `.open-next/worker.js`
- `.open-next/assets`

Those paths are already declared in `wrangler.jsonc`.

## What is checked automatically

`.github/workflows/cloudflare.yml` runs on relevant changes and verifies:

1. `npm ci`
2. OpenNext Worker build
3. Generated Worker/static asset files
4. PWA service-worker assets
5. Wrangler configuration with a deploy dry-run

A real production deployment still requires the Cloudflare account/project to exist and the Worker name/bindings to match this repository configuration.
