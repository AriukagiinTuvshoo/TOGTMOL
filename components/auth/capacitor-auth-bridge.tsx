"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { registerAuthDeepLinks } from "@/lib/auth/capacitor";

export function CapacitorAuthBridge() {
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    let active = true;
    let remove: (() => Promise<void>) | null = null;

    void registerAuthDeepLinks(client, (message) => {
      if (!active) return;
      window.dispatchEvent(
        new CustomEvent("togtmol-auth-error", { detail: message }),
      );
    }).then((cleanup) => {
      if (!active) {
        void cleanup();
        return;
      }
      remove = cleanup;
    });

    return () => {
      active = false;
      if (remove) void remove();
    };
  }, []);

  return null;
}
