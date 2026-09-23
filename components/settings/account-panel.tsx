"use client";
import { useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { useStoreState, useStudy } from "@/hooks/use-study";
import { SupabaseAdapter } from "@/lib/supabase/sync";
import { SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { authRedirectUrl, beginGoogleSignIn } from "@/lib/auth/capacitor";
export function AccountPanel() {
  const { client, user, error, status, sync, connect, logout, recovery } =
      useAccount(),
    { store, run, setNotice } = useStudy(),
    state = useStoreState();
  const [mode, setMode] = useState<"login" | "signup">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      guest: number;
      cloud: number;
      account: number;
    } | null>(null);
  const call = async (fn: () => Promise<void>, message?: string) => {
    setBusy(true);
    const ok = await run(fn, message);
    setBusy(false);
    return ok;
  };
  return (
    <section className="card">
      <SectionTitle
        title="Бүртгэл ба төхөөрөмжүүд"
        subtitle="Нэвтрэхгүйгээр бүх локал функцийг ашиглаж болно."
      />
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {!client ? (
        <div className="setup-note">
          <Icon name="cloud" size={26} />
          <h3>Локал горим бэлэн</h3>
          <p>
            Cloud бүртгэлийг идэвхжүүлэхийн тулд төслийн Supabase холболтыг
            тохируулна. Таны өгөгдөл энэ браузерт хадгалагдаж байна.
          </p>
        </div>
      ) : user ? (
        <div className="form-stack">
          <div className="account-identity">
            <span className="avatar">
              <Icon name="user" />
            </span>
            <div>
              <strong>{user.email ?? "Google бүртгэл"}</strong>
              <span>
                {state.namespace.startsWith("account:")
                  ? status
                  : "Локал өгөгдлөө ашиглаж байна"}
              </span>
            </div>
          </div>
          {recovery && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void call(async () => {
                  const { error } = await client.auth.updateUser({ password });
                  if (error) throw Error(error.message);
                  setPassword("");
                }, "Нууц үг шинэчлэгдлээ.");
              }}
            >
              <label>
                Шинэ нууц үг
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className="button primary" disabled={busy}>
                Нууц үг шинэчлэх
              </button>
            </form>
          )}
          {state.namespace === "guest" ? (
            <>
              <p className="muted">
                Локал түүхээ бүртгэлдээ нэгтгэх эсэхээ сонгоно уу. Эх өгөгдөл
                тусдаа хадгалагдана.
              </p>
              {!preview ? (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    call(async () => {
                      const cloud = await new SupabaseAdapter(client).pull(
                          user.id,
                        ),
                        account = await store.repository.load(
                          `account:${user.id}`,
                        );
                      setPreview({
                        guest: state.data.sessions.filter((s) => !s.deletedAt)
                          .length,
                        cloud: cloud.data.sessions.filter((s) => !s.deletedAt)
                          .length,
                        account:
                          account?.data.sessions.filter((s) => !s.deletedAt)
                            .length ?? 0,
                      });
                    })
                  }
                >
                  <Icon name="cloud" />
                  Нэгтгэх өгөгдлийг харах
                </button>
              ) : (
                <>
                  <div className="merge-counts">
                    <span>
                      Локал<strong>{preview.guest}</strong>хичээл
                    </span>
                    <span>
                      Cloud<strong>{preview.cloud}</strong>хичээл
                    </span>
                    <span>
                      Бүртгэлийн кэш<strong>{preview.account}</strong>хичээл
                    </span>
                  </div>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      call(() => connect(true), "Өгөгдлүүдийг нэгтгэлээ.")
                    }
                  >
                    Локал түүхтэйгээ нэгтгэх
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      call(() => connect(false), "Бүртгэлийн өгөгдлийг нээлээ.")
                    }
                  >
                    Зөвхөн бүртгэлийн өгөгдлийг нээх
                  </button>
                </>
              )}
            </>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={() => call(sync, "Cloud нэгтгэл дууслаа.")}
            >
              <Icon name="refresh" />
              Одоо sync хийх
            </button>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => call(logout, "Бүртгэлээс гарлаа.")}
          >
            Бүртгэлээс гарах
          </button>
          <p className="tiny muted">
            Бүртгэлээс гарахад түүх энэ төхөөрөмжийн тусдаа кэшид үлдэнэ. Timer
            зөвхөн эхлүүлсэн төхөөрөмж дээр үргэлжилнэ.
          </p>
        </div>
      ) : (
        <>
          <div className="segmented">
            <button
              aria-pressed={mode === "login"}
              onClick={() => setMode("login")}
            >
              Нэвтрэх
            </button>
            <button
              aria-pressed={mode === "signup"}
              onClick={() => setMode("signup")}
            >
              Бүртгүүлэх
            </button>
          </div>
          <form
            className="form-stack account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void call(async () => {
                const result =
                  mode === "login"
                    ? await client.auth.signInWithPassword({ email, password })
                    : await client.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: authRedirectUrl() },
                      });
                if (result.error) throw Error(result.error.message);
                setPassword("");
                if (mode === "signup" && !result.data.session)
                  setNotice("Бүртгэлээ баталгаажуулах захидлаа шалгана уу.");
              });
            }}
          >
            <label>
              И-мэйл
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Нууц үг
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="button primary" disabled={busy}>
              {mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
            </button>
          </form>
          <div className="auth-divider">эсвэл</div>
          <button
            className="button full"
            disabled={busy}
            onClick={() =>
              call(async () => {
                await beginGoogleSignIn(client);
              })
            }
          >
            Google-ээр үргэлжлүүлэх
          </button>
          <button
            className="text-button account-reset"
            disabled={busy}
            onClick={() =>
              call(async () => {
                if (!email.trim()) throw Error("Эхлээд и-мэйлээ оруулна уу.");
                const { error } = await client.auth.resetPasswordForEmail(
                  email,
                  { redirectTo: authRedirectUrl() },
                );
                if (error) throw Error(error.message);
              }, "Нууц үг сэргээх захидал илгээлээ.")
            }
          >
            Нууц үгээ мартсан
          </button>
        </>
      )}
    </section>
  );
}
