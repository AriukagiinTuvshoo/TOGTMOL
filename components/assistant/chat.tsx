"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { CompanionAvatar } from "@/components/world/companion";
import { PlanWizard } from "@/components/goals/goal-planner";
import { Assistant as LocalDetails } from "./insights";
import {
  localChatProvider,
  createAIChatProvider,
} from "@/lib/assistant/chat-provider";
import { getSupabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import { readMessages, type BondookMessage } from "@/lib/assistant/history";
import { uid } from "@/lib/constants";
import { useI18n } from "@/components/i18n/language-provider";
export function BondookChat() {
  const { data, index, today, navigate, store, run } = useStudy(),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [changingAI, setChangingAI] = useState(false),
    [messageLimit, setMessageLimit] = useState(100),
    [consent, setConsent] = useState(false),
    [forceLocal, setForceLocal] = useState(false),
    [notesConsent, setNotesConsent] = useState(false),
    [error, setError] = useState(""),
    [plan, setPlan] = useState<string | null>(null),
    end = useRef<HTMLDivElement>(null),
    request = useRef(0),
    disposed = useRef(false);
  const online = !forceLocal && data.settings.extras.aiEnabled === true;
  const includeNotes = data.settings.extras.aiIncludeNotes === true;
  const messages = useMemo(
    () => readMessages(data.extras.bondookMessages),
    [data.extras.bondookMessages],
  );
  const setAI = async (enabled: boolean, notes = false) => {
    setForceLocal(!enabled);
    const namespace = store.getSnapshot().namespace;
    setChangingAI(true);
    try {
      return await run(() =>
        store.mutate((d) => {
          if (store.getSnapshot().namespace !== namespace)
            throw Error("Бүртгэл өөрчлөгдсөн байна.");
          return {
            ...d,
            settings: {
              ...d.settings,
              updatedAt: Date.now(),
              extras: {
                ...d.settings.extras,
                aiEnabled: enabled,
                aiIncludeNotes: enabled && notes,
              },
            },
          };
        }),
      );
    } finally {
      setChangingAI(false);
    }
  };
  const append = async (
    message: Omit<BondookMessage, "id" | "createdAt">,
    namespace: string,
  ) =>
    store.mutate((d) => {
      if (store.getSnapshot().namespace !== namespace)
        throw Error("Бүртгэл өөрчлөгдсөн байна.");
      return {
        ...d,
        extras: {
          ...d.extras,
          bondookMessages: [
            ...(Array.isArray(d.extras.bondookMessages)
              ? d.extras.bondookMessages
              : []),
            { ...message, id: uid("message"), createdAt: Date.now() },
          ],
        },
      };
    });
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
    if (busy || changingAI || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setText("");
    const kind = online ? "ai" : "local",
      token = ++request.current,
      namespace = store.getSnapshot().namespace;
    try {
      await append(
        {
          role: "user",
          text: prompt,
          kind,
        },
        namespace,
      );
      const provider = online
        ? createAIChatProvider(async () => {
            if (store.getSnapshot().data.settings.extras.aiEnabled !== true)
              throw Error("Онлайн AI зөвшөөрөл унтраалттай байна.");
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
          }, includeNotes)
        : localChatProvider;
      const reply = await provider.reply(prompt, { data, index, today });
      if (
        !disposed.current &&
        request.current === token &&
        store.getSnapshot().namespace === namespace
      )
        await append(
          {
            ...reply,
            role: "assistant",
            kind,
          },
          namespace,
        );
    } catch (e) {
      if (
        !disposed.current &&
        request.current === token &&
        store.getSnapshot().namespace === namespace
      ) {
        setError(e instanceof Error ? e.message : "Түр алдаа гарлаа.");
        if (kind === "ai") {
          // Do not leave the UI in a broken "online" state after an auth,
          // network, or configuration failure. Switch the visible mode first,
          // then persist the preference in the background flow below.
          setForceLocal(true);
          setConsent(false);
          setNotesConsent(false);
          const fallback = await localChatProvider.reply(prompt, {
            data,
            index,
            today,
          });
          if (
            !disposed.current &&
            request.current === token &&
            store.getSnapshot().namespace === namespace
          ) {
            await append(
              {
                ...fallback,
                role: "assistant",
                kind: "local",
              },
              namespace,
            ).catch(store.reportError);
            await setAI(false);
          }
        }
      }
    } finally {
      if (!disposed.current && request.current === token) setBusy(false);
    }
  };
  return (
    <div className="stack">
      <section className="bondook-chat card">
        <div className="chat-header">
          <CompanionAvatar world={data.settings.world} />
          <div>
            <span className="eyebrow">{language === "en" ? "YOUR STUDY COMPANION" : "ТАНЫ СУРАЛЦАХ ХАМТРАГЧ"}</span>
            <h2>{t("assistant.greeting")}</h2>
            <p>{language === "en" ? "Let's choose one small step together." : "Нэг жижиг алхмыг хамт сонгоё."}</p>
          </div>
          <span className="badge">
            {online ? t("assistant.online") : t("assistant.local")}
          </span>
        </div>
        <div className="chat-options">
          <label className="check-label">
            <input
              type="checkbox"
              checked={online}
              disabled={busy || changingAI}
              onChange={(e) => {
                if (e.target.checked) {
                  setConsent(true);
                } else {
                  void setAI(false);
                  setConsent(false);
                }
              }}
            />
            Онлайн AI ашиглах
          </label>
          {!online && (
            <span className="tiny muted">
              Таны мэдээллийг гаднын AI руу илгээхгүй.
            </span>
          )}
          {online && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={includeNotes}
                disabled={busy || changingAI}
                onChange={(e) => void setAI(true, e.target.checked)}
              />
              Сүүлийн 5 хүртэл тэмдэглэл хуваалцах
            </label>
          )}
        </div>
        {consent && !online && (
          <div className="ai-consent">
            <p>
              Онлайн AI-д асуулт, хичээлийн нэр, зорилго, суралцсан хугацааны
              товч дүгнэлт илгээнэ. Тэмдэглэлийг доорх сонголтоор л хуваалцана.
              Серверийн AI тохиргоо болон зөвшөөрөгдсөн бүртгэл шаардлагатай.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={notesConsent}
                onChange={(e) => setNotesConsent(e.target.checked)}
              />
              Сүүлийн 7 өдрийн 5 хүртэл тэмдэглэлийг хуваалцах (тус бүр эхний
              500 тэмдэгт)
            </label>
            <div className="button-row">
              <button
                className="button small primary"
                onClick={() => {
                  void setAI(true, notesConsent);
                  setConsent(false);
                }}
              >
                Зөвшөөрч асаах
              </button>
              <button
                className="button small"
                onClick={() => setConsent(false)}
              >
                Төхөөрөмж дээр ашиглах
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
            "Хуваарь маань бодитой юу?",
            "Картаа давтъя",
            "Энэ сэдвийг энгийнээр тайлбарла",
            "Шалгалтын өмнөх 7 хоногийн давтлагын төлөвлөгөө гарга",
          ].map((q) => (
            <button
              className="button small"
              key={q}
              disabled={busy || changingAI}
              onClick={() => send(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <div
          className="chat-messages"
          role="log"
          aria-label="Бондооктой ярилцлага"
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
          {messages.length > messageLimit && (
            <button
              className="button small"
              onClick={() => setMessageLimit((v) => v + 100)}
            >
              Өмнөх зурвасууд
            </button>
          )}
          {messages.slice(-messageLimit).map((m) => (
            <article key={m.id} className={`chat-message chat-${m.role}`}>
              <small>
                {m.role === "user"
                  ? "Та"
                  : `Бондоок · ${m.kind === "local" ? "Local" : "AI"}`}
              </small>
              <p>{m.text}</p>
              {m.action && (
                <button
                  className="button small"
                  onClick={() =>
                    m.action === "plan"
                      ? setPlan(m.planPrompt ?? "")
                      : navigate(
                          m.action === "knowledge"
                            ? "knowledge"
                            : m.action === "timer"
                              ? "timer"
                              : "goals",
                        )
                  }
                >
                  {m.action === "plan"
                    ? "Төлөвлөгөө гаргах"
                    : m.action === "timer"
                      ? "Timer нээх"
                      : m.action === "knowledge"
                        ? "Мэдлэгийн сан"
                        : "Зорилго нээх"}
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </article>
          ))}
          {busy && <p className="muted">{t("assistant.thinking")}</p>}
          <div ref={end} />
        </div>
        {error && (
          <div role="alert" className="ai-consent">
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => {
                void setAI(false);
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
            aria-label={t("assistant.send")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            placeholder={language === "en" ? "Example: How was my week?" : "Жишээ: Энэ долоо хоног ямар байсан бэ?"}
            disabled={busy || changingAI}
          />
          <button
            className="button primary"
            aria-label="Бондоокт илгээх"
            disabled={busy || changingAI || !text.trim()}
          >
            <Icon name="arrow" />
          </button>
        </form>
        <p className="tiny muted">
          {online
            ? "AI санал алдаатай байж болно. Хуваарийг та хянаж хадгална."
            : "Local туслах нь цаг, зорилго, тэмдэглэлд тулгуурласан дүрмээр хариулна."}{" "}
          Ярилцлага таны өгөгдөлтэй хамт хадгалагдаж, JSON нөөцөд багтана.
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
