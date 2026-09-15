"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SupabaseAdapter, SyncEngine } from "@/lib/supabase/sync";
import { actions } from "@/lib/persistence/actions";
import { useStoreState, useStudy } from "./use-study";
interface AccountContextValue {
  client: SupabaseClient | null;
  user: User | null;
  error: string;
  status: string;
  sync: () => Promise<void>;
  connect: (includeGuest: boolean) => Promise<void>;
  logout: () => Promise<void>;
  recovery: boolean;
}
const AccountContext = createContext<AccountContextValue | null>(null);
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { store } = useStudy(),
    state = useStoreState(),
    [client, setClient] = useState<SupabaseClient | null>(null),
    [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Төхөөрөмж дээр хадгална"),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/supabase/client")
      .then(async ({ getSupabase }) => {
        if (!active) return;
        const sb = getSupabase();
        if (!sb) return;
        setClient(sb);
        const {
          data: { subscription },
        } = sb.auth.onAuthStateChange((event, session) => {
          queueMicrotask(() => {
            if (!active) return;
            setUser(session?.user ?? null);
            if (
              event === "SIGNED_OUT" &&
              store.getSnapshot().namespace.startsWith("account:")
            )
              void store
                .mutate(actions.pause())
                .then(() => store.switchNamespace("guest", true))
                .catch(store.reportError);
            if (event === "PASSWORD_RECOVERY") setRecovery(true);
          });
        });
        unsubscribe = () => subscription.unsubscribe();
        const { data, error } = await sb.auth.getSession();
        if (active) {
          if (error) setError(error.message);
          else setUser(data.session?.user ?? null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [store]);
  const engine = useMemo(
    () =>
      client && user
        ? new SyncEngine(store, new SupabaseAdapter(client), user.id)
        : null,
    [client, user, store],
  );
  const sync = useCallback(async () => {
    if (!engine) throw Error("Эхлээд бүртгэлдээ нэвтэрнэ үү.");
    setStatus("Нэгтгэж байна…");
    try {
      await engine.sync();
      setStatus("Cloud-д хадгалсан");
      setError("");
    } catch (e) {
      setStatus("Дахин оролдох шаардлагатай");
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [engine]);
  useEffect(() => {
    if (!user || !state.ready) return;
    let active = true;
    void store.repository
      .metadata<boolean>(`account-enabled:${user.id}`)
      .then((enabled) => {
        if (
          active &&
          enabled &&
          store.getSnapshot().namespace === "guest" &&
          !store.getSnapshot().data.activeTimer
        )
          void store
            .switchNamespace(`account:${user.id}`)
            .catch(store.reportError);
      });
    return () => {
      active = false;
    };
  }, [user, state.ready, store]);
  useEffect(() => {
    if (!engine || !user || state.namespace !== `account:${user.id}`) return;
    const attempt = () => {
      if (navigator.onLine) void sync().catch(() => {});
      else setStatus("Offline · төхөөрөмж дээр хадгалсан");
    };
    const id = setTimeout(attempt, 3000);
    window.addEventListener("online", attempt);
    const offline = () => setStatus("Offline · төхөөрөмж дээр хадгалсан");
    window.addEventListener("offline", offline);
    return () => {
      clearTimeout(id);
      window.removeEventListener("online", attempt);
      window.removeEventListener("offline", offline);
    };
  }, [engine, user, state.namespace, state.revision, sync]);
  const connect = async (includeGuest: boolean) => {
    if (!user || !client) throw Error("Бүртгэлдээ нэвтэрнэ үү.");
    if (store.getSnapshot().data.activeTimer)
      throw Error("Timer-аа эхлээд хадгалж эсвэл цуцална уу.");
    const guest = includeGuest ? await store.repository.load("guest") : null;
    if (guest)
      await store.repository.backup(
        "guest",
        "Бүртгэлтэй нэгтгэхийн өмнө",
        JSON.stringify(guest.data),
      );
    await store.switchNamespace(`account:${user.id}`);
    if (guest)
      await store.importData(
        JSON.stringify(guest.data),
        "Guest нэгтгэхийн өмнө",
      );
    await store.repository.setMetadata(`account-enabled:${user.id}`, true);
    await new SyncEngine(store, new SupabaseAdapter(client), user.id).sync();
    setStatus("Cloud-д хадгалсан");
  };
  const logout = async () => {
    if (store.getSnapshot().data.activeTimer)
      throw Error("Timer-аа эхлээд хадгалж эсвэл цуцална уу.");
    // Switch first: a signed-out browser never displays the previous account as guest.
    await store.switchNamespace("guest");
    if (user)
      await store.repository.setMetadata(`account-enabled:${user.id}`, false);
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw Error(error.message);
    }
    setUser(null);
    setStatus("Төхөөрөмж дээр хадгална");
  };
  return (
    <AccountContext.Provider
      value={{ client, user, error, status, sync, connect, logout, recovery }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw Error("AccountProvider шаардлагатай.");
  return context;
}
