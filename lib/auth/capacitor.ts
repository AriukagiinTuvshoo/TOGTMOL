import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_CALLBACK_URL = "togtmol://auth/callback";

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function authRedirectUrl(): string {
  return isNativeApp() ? AUTH_CALLBACK_URL : window.location.origin;
}

export async function beginGoogleSignIn(
  client: SupabaseClient,
): Promise<void> {
  const native = isNativeApp();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      skipBrowserRedirect: native,
    },
  });
  if (error) throw Error(error.message);
  if (native && data.url) await Browser.open({ url: data.url });
}

export async function registerAuthDeepLinks(
  client: SupabaseClient,
  onError?: (message: string) => void,
): Promise<() => Promise<void>> {
  if (!isNativeApp()) return async () => {};

  const handleUrl = async (url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (
      parsed.protocol !== "togtmol:" ||
      parsed.hostname !== "auth" ||
      parsed.pathname !== "/callback"
    )
      return;

    const error =
      parsed.searchParams.get("error_description") ??
      parsed.searchParams.get("error");
    if (error) {
      onError?.(decodeURIComponent(error.replace(/\+/g, " ")));
      return;
    }

    const code = parsed.searchParams.get("code");
    if (!code) return;

    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error) {
      onError?.("Нэвтрэлтийн холбоосыг баталгаажуулж чадсангүй: " + result.error.message);
      return;
    }

    try {
      await Browser.close();
    } catch {
      // The browser plugin may already have closed when the app resumed.
    }
  };

  const listener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleUrl(url).catch((error: unknown) => {
      onError?.(
        error instanceof Error
          ? error.message
          : "Нэвтрэлтийн callback боловсруулж чадсангүй.",
      );
    });
  });

  try {
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) void handleUrl(launchUrl.url);
  } catch {
    // Cold-start URL delivery is best-effort; appUrlOpen still handles future links.
  }

  return async () => {
    await listener.remove();
  };
}
