"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { CompanionAvatar } from "@/components/world/companion";
import { PlanWizard } from "@/components/goals/goal-planner";
import { Assistant as LocalDetails } from "./insights";
import {
  localChatProvider,
  createAIChatProvider,
  type ChatReply,
} from "@/lib/assistant/chat-provider";
import { getSupabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
interface Message extends ChatReply {
  id: number;
  role: "user" | "assistant";
  kind: "local" | "ai";
}
export function TogiChat() {
  const { data, index, today, navigate, store } = useStudy(),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(false),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<string | null>(null),
    end = useRef<HTMLDivElement>(null),
    request = useRef(0),
    disposed = useRef(false);
  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages]);
  const send = async (prompt: string) => {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setText("");
    const kind = online ? "ai" : "local",
      token = ++request.current,
      namespace = store.getSnapshot().namespace;
    setMessages((m) => [
      ...m,
      { id: token * 2, role: "user", text: prompt, kind },
    ]);
    try {
      const provider = online
        ? createAIChatProvider(async () => {
            const client = await getSupabase();
            const session = client
              ? (await client.auth.getSession()).data.session
              : null;
            if (
              store.getSnapshot().namespace !== namespace ||
              namespace !== `account:${session?.user.id}`
            )
              return null;
            return session?.access_token ?? null;
          })
        : localChatProvider;
      const reply = await provider.reply(prompt, { data, index, today });
      if (!disposed.current && request.current === token)
        setMessages((m) => [
          ...m,
          { ...reply, id: token * 2 + 1, role: "assistant", kind },
        ]);
    } catch (e) {
      if (!disposed.current && request.current === token)
        setError(e instanceof Error ? e.message : "Түр алдаа гарлаа.");
    } finally {
      if (!disposed.current && request.current === token) setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="togi-chat card">
        <div className="chat-header">
          <CompanionAvatar world={data.settings.world} />
          <div>
            <span className="eyebrow">YOUR STUDY COMPANION</span>
            <h2>Сайн уу, би Тоги.</h2>
            <p>Нэг жижиг алхмыг хамт сонгоё.</p>
          </div>
          <span className="badge">
            {online ? "ONLINE AI" : "LOCAL INSIGHTS"}
          </span>
        </div>
        <div className="chat-options">
          <label className="check-label">
            <input
              type="checkbox"
              checked={online}
              disabled={busy}
              onChange={(e) => {
                if (e.target.checked) {
                  setConsent(true);
                } else setOnline(false);
              }}
            />
            Онлайн AI ашиглах
          </label>
          {!online && (
            <span className="tiny muted">
              Таны мэдээллийг гаднын AI руу илгээхгүй.
            </span>
          )}
        </div>
        {consent && !online && (
          <div className="ai-consent">
            <p>
              Онлайн AI-д асуулт, хичээлийн нэр, зорилго, суралцсан хугацааны
              товч дүгнэлт илгээнэ. Хичээлийн тэмдэглэл илгээхгүй. Серверийн AI
              тохиргоо болон зөвшөөрөгдсөн бүртгэл шаардлагатай.
            </p>
            <div className="button-row">
              <button
                className="button small primary"
                onClick={() => {
                  setOnline(true);
                  setConsent(false);
                }}
              >
                Зөвшөөрч асаах
              </button>
              <button
                className="button small"
                onClick={() => setConsent(false)}
              >
                Local хэвээр
              </button>
            </div>
          </div>
        )}
        <div className="chat-quick-actions">
          {[
            "Зорилго төлөвлөе",
            "Долоо хоногоо харъя",
            "Өнөөдөр юу хийх вэ?",
            "Тэмдэглэлээ дүгнэе",
          ].map((q) => (
            <button
              className="button small"
              key={q}
              disabled={busy}
              onClick={() => send(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <div
          className="chat-messages"
          role="log"
          aria-label="Тогитой ярилцлага"
          aria-live="polite"
        >
          {!messages.length && (
            <div className="chat-welcome">
              <Icon name="leaf" size={35} />
              <p>
                Таны жижиг алхам бүр энд үлдэнэ.
                <br />
                Өнөөдөр юунаас эхлэх вэ?
              </p>
            </div>
          )}
          {messages.map((m) => (
            <article key={m.id} className={`chat-message chat-${m.role}`}>
              <small>
                {m.role === "user"
                  ? "Та"
                  : `Тоги · ${m.kind === "local" ? "Local" : "AI"}`}
              </small>
              <p>{m.text}</p>
              {m.action && (
                <button
                  className="button small"
                  onClick={() =>
                    m.action === "plan"
                      ? setPlan("")
                      : navigate(m.action === "timer" ? "timer" : "goals")
                  }
                >
                  {m.action === "plan"
                    ? "Төлөвлөгөө гаргах"
                    : m.action === "timer"
                      ? "Timer нээх"
                      : "Зорилго нээх"}
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </article>
          ))}
          {busy && <p className="muted">Тоги бодож байна…</p>}
          <div ref={end} />
        </div>
        {error && (
          <div role="alert" className="ai-consent">
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => {
                setOnline(false);
                setError("");
              }}
            >
              Local туслах руу шилжих
            </button>
          </div>
        )}
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input
            aria-label="Тогид бичих"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            placeholder="Жишээ: Энэ долоо хоног ямар байсан бэ?"
            disabled={busy}
          />
          <button
            className="button primary"
            aria-label="Тогид илгээх"
            disabled={busy || !text.trim()}
          >
            <Icon name="arrow" />
          </button>
        </form>
        <p className="tiny muted">
          {online
            ? "AI санал алдаатай байж болно. Хуваарийг та хянаж хадгална."
            : "Local туслах нь цаг, зорилго, тэмдэглэлд тулгуурласан дүрмээр хариулна."}{" "}
          Ярилцлага энэ хуудсыг хаахад арилна.
        </p>
      </section>
      <details className="card">
        <summary>Дэлгэрэнгүй дүгнэлт, өнөөдрийн алхмууд</summary>
        <LocalDetails />
      </details>
      {plan !== null && (
        <PlanWizard initial={plan} onClose={() => setPlan(null)} />
      )}
    </div>
  );
}
