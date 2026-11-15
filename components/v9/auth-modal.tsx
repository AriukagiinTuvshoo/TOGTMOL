"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  Sparkles,
  Mic,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  Volume2,
  Trash2,
  Download,
  Upload,
  LogOut,
  RefreshCw,
  Mail,
} from "lucide-react";
import { Modal, downloadJson } from "@/components/ui/common";
import { useAccount } from "@/hooks/use-account";
import { useStudy } from "@/hooks/use-study";
import {
  GEMINI_MODELS,
  clearGeminiConfig,
  probeGeminiServerStatus,
  readGeminiConfig,
  subscribeGeminiConfig,
  testGeminiConnection,
  writeGeminiConfig,
  type GeminiDeviceConfig,
  type GeminiModelId,
} from "@/lib/assistant/gemini";
import {
  TTS_PRESETS,
  speakText,
  type TtsVoicePreset,
} from "@/lib/voice/speech-engine";

export type AuthModalTab = "account" | "gemini" | "voice";

export function AuthModal({
  initialTab = "account",
  onClose,
}: {
  initialTab?: AuthModalTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AuthModalTab>(initialTab);
  const {
    client,
    user,
    status,
    error: authError,
    sync,
    connect,
    logout,
    syncEnabled,
  } = useAccount();
  const { store, today, run } = useStudy();
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [cloudBackupMsg, setCloudBackupMsg] = useState("");

  // Account form state
  const [authMode, setAuthMode] = useState<"login" | "signup" | "magic">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [localError, setLocalError] = useState("");

  // Gemini state
  const [geminiCfg, setGeminiCfg] = useState<GeminiDeviceConfig>(() =>
    readGeminiConfig(),
  );
  const [keyDraft, setKeyDraft] = useState(() => readGeminiConfig().apiKey);
  const [serverHasGemini, setServerHasGemini] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Voice TTS state
  const [ttsPreset, setTtsPreset] = useState<TtsVoicePreset>(() => {
    if (typeof window === "undefined") return "warm";
    return (
      (window.localStorage.getItem("togtmol:tts:preset") as TtsVoicePreset) ||
      "warm"
    );
  });

  useEffect(() => {
    let alive = true;
    void probeGeminiServerStatus().then((res) => {
      if (alive) setServerHasGemini(res.configuredOnServer);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeGeminiConfig(() => {
        setGeminiCfg(readGeminiConfig());
      }),
    [],
  );

  const runAuth = async (fn: () => Promise<void>, doneNotice?: string) => {
    setAuthBusy(true);
    setLocalError("");
    setAuthNotice("");
    try {
      await fn();
      if (doneNotice) setAuthNotice(doneNotice);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveAndTestGemini = async () => {
    const cleanKey = keyDraft.trim();
    if (!cleanKey && !serverHasGemini) {
      setTestResult({
        ok: false,
        message: "Эхлээд Google AI Studio API түлхүүрээ оруулна уу.",
      });
      return;
    }
    setTestBusy(true);
    setTestResult(null);
    writeGeminiConfig({
      apiKey: cleanKey,
      enabled: true,
      model: geminiCfg.model,
    });
    // Also mark aiEnabled = true in StudyStore so Bondook Chat switches immediately to Online AI
    await store.mutate(
      (d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, aiEnabled: true },
        },
      }),
      { reportError: false, reportBusy: false },
    );
    const res = await testGeminiConnection({
      apiKey: cleanKey,
      model: geminiCfg.model,
    });
    setTestBusy(false);
    setTestResult({
      ok: res.ok,
      message: res.ok
        ? `Амжилттай холбогдлоо (${res.model}): "${res.reply}"`
        : res.error || "Холбогдож чадсангүй.",
    });
  };

  const downloadLocalBackup = async () => {
    const payload = JSON.stringify(store.exportData(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `togtmol-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Бүртгэл · Google AI · Дуу хоолой" onClose={onClose}>
      <div className="space-y-4">
        {/* Top Segmented Tabs */}
        <div
          className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/25 p-1.5 ring-1 ring-white/10"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "account"}
            onClick={() => setTab("account")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              tab === "account"
                ? "bg-amber-400 text-slate-950"
                : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Cloud size={14} /> Нэвтрэх
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gemini"}
            onClick={() => setTab("gemini")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              tab === "gemini"
                ? "bg-amber-400 text-slate-950"
                : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Sparkles size={14} /> Google AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "voice"}
            onClick={() => setTab("voice")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              tab === "voice"
                ? "bg-amber-400 text-slate-950"
                : "text-white/75 hover:bg-white/10"
            }`}
          >
            <Mic size={14} /> Хоолой
          </button>
        </div>

        {/* TAB 1: ACCOUNT & CLOUD LOGIN */}
        {tab === "account" && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3.5 py-2.5 ring-1 ring-white/10">
              <div>
                <div className="text-xs font-bold">
                  {user
                    ? `Нэвтэрсэн: ${user.email}`
                    : "Зочны горим (Local-First)"}
                </div>
                <div className="text-[11px] opacity-70">{status}</div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                  user
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-amber-400/20 text-amber-200"
                }`}
              >
                {user ? "Cloud Ready" : "Офлайн Хадгалалт"}
              </span>
            </div>

            {(localError || authError) && (
              <p
                role="alert"
                className="rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/30"
              >
                {localError || authError}
              </p>
            )}
            {authNotice && (
              <p
                role="status"
                className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-400/30"
              >
                {authNotice}
              </p>
            )}

            {!client ? (
              <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <p className="text-xs leading-relaxed opacity-85">
                  Таны бүх хичээлийн цаг, зорилго, тэмдэглэл болон картууд{" "}
                  <b>энэ төхөөрөмжийн IndexedDB санд 100% найдвартай</b>{" "}
                  хадгалагдаж байна. Олон төхөөрөмжийн Cloud Sync идэвхжүүлэхийн
                  тулд орчны хувьсагчид (<code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) тохируулж болно.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadLocalBackup()}
                    className="button small flex items-center gap-1.5"
                  >
                    <Download size={14} /> Нөөц файл (JSON) татах
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("gemini")}
                    className="button primary small flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Бүртгэлгүйгээр Google AI холбох →
                  </button>
                </div>
              </div>
            ) : user ? (
              <div className="space-y-2.5">
                {!syncEnabled ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="button primary"
                      disabled={authBusy}
                      onClick={() =>
                        void runAuth(
                          () => connect(true),
                          "Локал түүхийг бүртгэлтэй нэгтгэлээ!",
                        )
                      }
                    >
                      Локал өгөгдөлтэй нэгтгэх
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={authBusy}
                      onClick={() =>
                        void runAuth(
                          () => connect(false),
                          "Cloud бүртгэлийн өгөгдлийг ачааллаа.",
                        )
                      }
                    >
                      Зөвхөн Cloud өгөгдөл нээх
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button primary flex w-full items-center justify-center gap-2"
                    disabled={authBusy}
                    onClick={() =>
                      void runAuth(sync, "Cloud синк амжилттай дууслаа!")
                    }
                  >
                    <RefreshCw size={15} /> Одоо Cloud Sync хийх
                  </button>
                )}
                <button
                  type="button"
                  className="button flex w-full items-center justify-center gap-2"
                  disabled={authBusy}
                  onClick={() =>
                    void runAuth(logout, "Бүртгэлээс амжилттай гарлаа.")
                  }
                >
                  <LogOut size={15} /> Бүртгэлээс гарах
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="segmented">
                  <button
                    type="button"
                    aria-pressed={authMode === "login"}
                    onClick={() => setAuthMode("login")}
                  >
                    Нэвтрэх
                  </button>
                  <button
                    type="button"
                    aria-pressed={authMode === "signup"}
                    onClick={() => setAuthMode("signup")}
                  >
                    Бүртгүүлэх
                  </button>
                  <button
                    type="button"
                    aria-pressed={authMode === "magic"}
                    onClick={() => setAuthMode("magic")}
                  >
                    Magic Link
                  </button>
                </div>

                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runAuth(async () => {
                      if (authMode === "magic") {
                        const { error } = await client.auth.signInWithOtp({
                          email,
                          options: {
                            emailRedirectTo: window.location.origin,
                          },
                        });
                        if (error) throw new Error(error.message);
                        setAuthNotice(
                          "И-мэйл рүү тань нэвтрэх линк илгээлээ. Шуудангаа шалгана уу!",
                        );
                        return;
                      }
                      const res =
                        authMode === "login"
                          ? await client.auth.signInWithPassword({
                              email,
                              password,
                            })
                          : await client.auth.signUp({
                              email,
                              password,
                              options: {
                                emailRedirectTo: window.location.origin,
                              },
                            });
                      if (res.error) throw new Error(res.error.message);
                      setPassword("");
                      if (authMode === "signup" && !res.data.session) {
                        setAuthNotice(
                          "Бүртгэл баталгаажуулах захидлаа шалгана уу.",
                        );
                      }
                    });
                  }}
                >
                  <label>
                    И-мэйл хаяг
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                    />
                  </label>
                  {authMode !== "magic" && (
                    <label>
                      Нууц үг
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete={
                          authMode === "login"
                            ? "current-password"
                            : "new-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8 ба түүнээс дээш тэмдэгт"
                      />
                    </label>
                  )}
                  <button className="button primary full" disabled={authBusy}>
                    {authMode === "login"
                      ? "Нэвтрэх"
                      : authMode === "signup"
                        ? "Бүртгүүлэх"
                        : "И-мэйл линк илгээх"}
                  </button>
                </form>

                <div className="auth-divider">эсвэл</div>
                <button
                  type="button"
                  className="button full flex items-center justify-center gap-2"
                  disabled={authBusy}
                  onClick={() =>
                    void runAuth(async () => {
                      const { error } = await client.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: window.location.origin },
                      });
                      if (error) throw new Error(error.message);
                    })
                  }
                >
                  <Mail size={15} /> Google хаягаар үргэлжлүүлэх
                </button>
              </div>
            )}

            {/* 1-Tap Google Drive / iCloud / Mobile File Backup & Restore */}
            <div className="rounded-2xl border border-indigo-400/25 bg-indigo-950/25 p-3.5 text-xs">
              <div className="mb-1.5 font-bold text-indigo-200">
                ☁️ Google Drive / Утас хооронд 1-товчоор нөөцлөх
              </div>
              <p className="mb-2.5 text-[11px] leading-relaxed text-slate-300">
                Бүртгэл үүсгэлгүйгээр бүх хичээл, карт, тэмдэглэлээ{" "}
                <b>Google Drive</b>, <b>iCloud Files</b> эсвэл утас руугаа
                хадгалж, шинэ төхөөрөмж дээр сэргээнэ.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={async () => {
                    const exported = store.exportData();
                    const jsonStr = JSON.stringify(exported, null, 2);
                    const fileName = `togtmol-backup-${today}.json`;
                    try {
                      if (navigator.share) {
                        const file = new File([jsonStr], fileName, {
                          type: "application/json",
                        });
                        if (
                          !navigator.canShare ||
                          navigator.canShare({ files: [file] })
                        ) {
                          await navigator.share({
                            title: "TOGTMOL Study OS Нөөц",
                            text: "Google Drive эсвэл Files руу хадгалаарай",
                            files: [file],
                          });
                          setCloudBackupMsg(
                            "✓ Drive / Утас руу амжилттай хуваалцлаа!",
                          );
                          return;
                        }
                      }
                    } catch {
                      /* fallback to direct file download */
                    }
                    downloadJson(exported, fileName);
                    setCloudBackupMsg("✓ JSON нөөц файл татагдлаа!");
                  }}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-indigo-500/25 px-3 py-2 font-bold text-indigo-100 ring-1 ring-indigo-400/35 hover:bg-indigo-500/35"
                >
                  <Download size={14} /> Drive / Утас руу хадгалах
                </button>
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-white/8 px-3 py-2 font-bold text-slate-100 ring-1 ring-white/15 hover:bg-white/15"
                >
                  <Upload size={14} /> Нөөцөөс сэргээх
                </button>
              </div>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const raw = await file.text();
                  const ok = await run(
                    () => store.importData(raw),
                    "Нөөц файлыг амжилттай сэргээж нэгтгэлээ! 🎉",
                  );
                  setCloudBackupMsg(
                    ok
                      ? "✓ Нөөц файл амжилттай сэргээгдлээ!"
                      : "✕ Файлын бүтэц буруу байна.",
                  );
                  e.target.value = "";
                }}
              />
              {cloudBackupMsg && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-300">
                  {cloudBackupMsg}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GOOGLE AI STUDIO (GEMINI) */}
        {tab === "gemini" && (
          <div className="space-y-3.5">
            <div className="rounded-2xl bg-amber-400/10 p-3.5 text-xs leading-relaxed ring-1 ring-amber-400/30">
              <div className="flex items-center justify-between gap-2 font-bold text-amber-200">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={14} /> Бондоок × Google AI Studio (Gemini)
                </span>
                {geminiCfg.enabled && (geminiCfg.apiKey || serverHasGemini) && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-300">
                    <CheckCircle2 size={11} /> Идэвхтэй
                  </span>
                )}
              </div>
              <p className="mt-1.5 opacity-85">
                Google AI Studio холбосноор <b>Бондоок Чат</b>,{" "}
                <b>AI Флашкарт үүсгэгч</b>, <b>AI Сорил (Quiz)</b> болон{" "}
                <b>Ухаалаг Сурах Төлөвлөгөө</b> бүртгэл шаардахгүйгээр шууд
                ажиллана!
              </p>
            </div>

            {serverHasGemini && !keyDraft && (
              <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-400/30">
                ✓ Сервер дээр <code>GEMINI_API_KEY</code> тохируулагдсан байна.
                Та өөрийн хувийн түлхүүрийг доор нэмж оруулах эсвэл шууд{" "}
                <b>Холболт шалгах & Идэвхжүүлэх</b> дарж болно.
              </div>
            )}

            <label className="block space-y-1.5 text-xs font-semibold">
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound size={13} /> Google AI Studio API Түлхүүр
                </span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-amber-300 hover:underline"
                >
                  Үнэгүй түлхүүр авах <ExternalLink size={11} />
                </a>
              </span>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="AIzaSy... эсвэл AQ.Ab8RN6..."
                autoComplete="off"
                className="w-full rounded-xl bg-black/35 px-3 py-2.5 font-mono text-xs ring-1 ring-white/15"
              />
              <small className="block text-[11px] font-normal opacity-65">
                Түлхүүр зөвхөн таны энэ төхөөрөмжийн хөтөчид хадгалагдах ба Git
                болон үүлэн серверт хэзээ ч илгээгдэхгүй.
              </small>
            </label>

            <label className="block space-y-1.5 text-xs font-semibold">
              <span>Загвар (Gemini Model) сонгох</span>
              <select
                value={geminiCfg.model}
                onChange={(e) =>
                  writeGeminiConfig({ model: e.target.value as GeminiModelId })
                }
                className="w-full rounded-xl bg-black/35 px-3 py-2 text-xs ring-1 ring-white/15"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </select>
            </label>

            {testResult && (
              <p
                role={testResult.ok ? "status" : "alert"}
                className={`rounded-xl px-3 py-2.5 text-xs ${
                  testResult.ok
                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/35"
                    : "bg-red-500/15 text-red-200 ring-1 ring-red-400/35"
                }`}
              >
                {testResult.message}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={testBusy}
                onClick={() => void handleSaveAndTestGemini()}
                className="button primary flex-1"
              >
                {testBusy ? "Шалгаж байна…" : "⚡ Хадгалаад Холболт Шалгах"}
              </button>
              {(geminiCfg.apiKey || geminiCfg.enabled) && (
                <button
                  type="button"
                  onClick={() => {
                    clearGeminiConfig();
                    setKeyDraft("");
                    setTestResult({
                      ok: true,
                      message: "Төхөөрөмж дээрх Google AI түлхүүрийг устгалаа.",
                    });
                  }}
                  className="button flex items-center gap-1"
                >
                  <Trash2 size={14} /> Устгах
                </button>
              )}
            </div>

            <details className="rounded-2xl bg-white/5 p-3 text-xs ring-1 ring-white/10">
              <summary className="cursor-pointer font-bold">
                📖 Google AI Studio хэрхэн холбох вэ? (Заавар)
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11.5px] leading-relaxed opacity-85">
                <li>
                  <b>aistudio.google.com/apikey</b> холбоосоор Google хаягаараа
                  нэвтэрнэ.
                </li>
                <li>
                  Баруун дээд буланд байрлах <b>Create API key</b> товчийг дарж
                  түлхүүр үүсгэнэ (<code>AIzaSy...</code> эсвэл Google Cloud
                  Express <code>AQ...</code> түлхүүр).
                </li>
                <li>
                  Дээрх нүдэнд түлхүүрээ хуулж тавиад{" "}
                  <b>⚡ Хадгалаад Холболт Шалгах</b> дарна.
                </li>
                <li>
                  Үүний дараа <b>Бондоок</b> цэс рүү орж хичээлээ асуух,
                  зураг/тэмдэглэлээс карт ба сорил үүсгэх боломжтой!
                </li>
              </ol>
            </details>
          </div>
        )}

        {/* TAB 3: VOICE & TTS SETTINGS */}
        {tab === "voice" && (
          <div className="space-y-3.5">
            <div className="rounded-2xl bg-white/5 p-3.5 text-xs leading-relaxed ring-1 ring-white/10">
              <div className="font-bold">
                🎙️ TOGTMOL Voice OS (Монгол · Англи · Япон)
              </div>
              <p className="mt-1 opacity-80">
                Дээд мөрний <b>🎙️</b> товч эсвэл <code>Alt + V</code> дарж
                хаанаас ч дуу хоолойгоор таймер удирдах, орчны дуу солих,
                даалгавар/тэмдэглэл бичих боломжтой.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold">
                🔊 Бондоокийн унших хоолойн өнгө (TTS Preset)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TTS_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setTtsPreset(p.id);
                      try {
                        window.localStorage.setItem("togtmol:tts:preset", p.id);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold ring-1 transition ${
                      ttsPreset === p.id
                        ? "bg-amber-400/20 text-amber-200 ring-amber-400/50"
                        : "bg-white/5 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div>{p.label}</div>
                    <div className="text-[10.5px] opacity-60">
                      Хурд {p.rate}x · Өнгө {p.pitch}
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  speakText(
                    "Сайн уу? Би Бондоок байна. Өнөөдөр хоёулаа тайван, төвлөрөлтэй суралцъя!",
                    { preset: ttsPreset },
                  )
                }
                className="button small flex items-center gap-1.5"
              >
                <Volume2 size={14} /> Хоолой сонсож шалгах
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
