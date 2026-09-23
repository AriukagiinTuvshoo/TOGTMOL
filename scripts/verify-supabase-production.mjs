import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_PRODUCTION_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const key =
  process.env.SUPABASE_PRODUCTION_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const email = process.env.SUPABASE_TEST_EMAIL ?? "";
const password = process.env.SUPABASE_TEST_PASSWORD ?? "";
const expectedProjectRef = process.env.SUPABASE_EXPECTED_PROJECT_REF ?? "";
const requireConfirmedEmail =
  process.env.SUPABASE_REQUIRE_CONFIRMED_EMAIL === "1";

function fail(message) {
  console.error("\nSupabase production smoke test failed:");
  console.error(message);
  process.exitCode = 1;
}

if (!url || !key || !email || !password) {
  fail(
    [
      "Set SUPABASE_PRODUCTION_URL (or NEXT_PUBLIC_SUPABASE_URL),",
      "SUPABASE_PRODUCTION_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),",
      "SUPABASE_TEST_EMAIL, and SUPABASE_TEST_PASSWORD.",
    ].join("\n"),
  );
  process.exit();
}

if (!/^https:\/\/[A-Za-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  fail("SUPABASE_PRODUCTION_URL must be a Supabase project URL.");
  process.exit();
}

if (key.startsWith("sb_secret_")) {
  fail(
    "A secret/service-role key cannot be used by this browser-compatible smoke test. Use a publishable key.",
  );
  process.exit();
}

if (expectedProjectRef) {
  const projectRef = new URL(url).hostname.split(".")[0];
  if (projectRef !== expectedProjectRef) {
    fail(
      `Connected to project "${projectRef}", but SUPABASE_EXPECTED_PROJECT_REF is "${expectedProjectRef}".`,
    );
    process.exit();
  }
}

const client = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data: signedIn, error: signInError } =
  await client.auth.signInWithPassword({
    email,
    password,
  });

if (signInError || !signedIn.user) {
  fail(
    signInError?.message ??
      "The test account could not sign in.",
  );
  process.exit();
}

const { data: userData, error: userError } = await client.auth.getUser();
if (userError || !userData.user) {
  await client.auth.signOut();
  fail(userError?.message ?? "Supabase did not return the authenticated user.");
  process.exit();
}

if (
  requireConfirmedEmail &&
  !userData.user.email_confirmed_at
) {
  await client.auth.signOut();
  fail(
    "The test account is not email-confirmed. Confirm the production account, then rerun the smoke test.",
  );
  process.exit();
}

const userId = userData.user.id;

const { data: profile, error: profileError } = await client
  .from("study_profiles")
  .select("user_id, revision")
  .eq("user_id", userId)
  .maybeSingle();

if (profileError) {
  await client.auth.signOut();
  fail(`Authenticated RLS read failed: ${profileError.message}`);
  process.exit();
}

const { data: snapshot, error: pullError } = await client.rpc(
  "pull_study_data",
  { expected_user_id: userId },
);

if (pullError) {
  await client.auth.signOut();
  fail(`pull_study_data failed: ${pullError.message}`);
  process.exit();
}

if (
  !snapshot ||
  typeof snapshot !== "object" ||
  typeof snapshot.revision !== "number" ||
  !snapshot.data ||
  snapshot.data.schemaVersion !== 5
) {
  await client.auth.signOut();
  fail("The production database returned an unexpected v5 study snapshot.");
  process.exit();
}

await client.auth.signOut();

const projectRef = new URL(url).hostname.split(".")[0];
console.log(
  JSON.stringify(
    {
      ok: true,
      projectRef,
      userId,
      emailConfirmed: Boolean(userData.user.email_confirmed_at),
      profileExists: Boolean(profile),
      revision: snapshot.revision,
      schemaVersion: snapshot.data.schemaVersion,
      checked: [
        "password sign-in",
        "authenticated getUser",
        "RLS study_profiles read",
        "pull_study_data RPC",
        "v5 schema snapshot",
      ],
    },
    null,
    2,
  ),
);

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Note: SUPABASE_SERVICE_ROLE_KEY is present in this shell but is intentionally not used by this smoke test. The current TOGTMOL data/auth path is designed to work with the authenticated publishable-key flow.",
  );
}
