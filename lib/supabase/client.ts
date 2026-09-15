import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null | undefined;
export function publicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !key) return null;
  if (!url || !key)
    throw Error("Supabase URL болон publishable key хоёуланг тохируулна уу.");
  if (
    !/^https:\/\//.test(url) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)
  )
    throw Error("Supabase URL буруу байна.");
  if (key.startsWith("sb_secret_"))
    throw Error(
      "Secret key-г браузерт ашиглахгүй. Publishable key тохируулна уу.",
    );
  if (key.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (claims.role !== "anon") throw Error("invalid");
    } catch {
      throw Error("Зөвхөн publishable эсвэл legacy anon key ашиглана.");
    }
  }
  return { url, key };
}
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = publicConfiguration();
  client = config
    ? createClient(config.url, config.key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
  return client;
}
