"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  Eye,
  Accessibility,
  Keyboard,
  Languages,
  Plus,
  Check,
  Mic,
} from "lucide-react";
import { VocabHelper } from "@/components/v9/vocab-helper";
import { Modal } from "@/components/ui/common";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { addCards, recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { uid } from "@/lib/constants";
import { engine } from "@/lib/v9/audio-engine";
import {
  BrowserVoiceSession,
  isBrowserSpeechSupported,
} from "@/lib/voice/speech-engine";
import { processVoiceTranscript } from "@/lib/voice/text-processor";
import type { FlashcardDeck, StudyNote } from "@/types/knowledge";

export function QuickToolsModal({ onClose }: { onClose: () => void }) {
  const { data, store, today } = useStudy();
  const [tab, setTab] = useState<"capture" | "vocab" | "eye" | "a11y" | "keys">(
    "capture",
  );

  // Quick Capture state
  const [captureKind, setCaptureKind] = useState<"note" | "task" | "card">(
    "note",
  );
  const [frontOrTitle, setFrontOrTitle] = useState("");
  const [bodyOrBack, setBodyOrBack] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [dictating, setDictating] = useState(false);

  // 20-20-20 Eye Rest Timer
  const [eyeSec, setEyeSec] = useState<number | null>(null);

  // Accessibility preferences
  const [fontScale, setFontScale] = useState<string>(() => {
    if (typeof window === "undefined") return "100";
    return window.localStorage.getItem("togtmol:a11y:scale") || "100";
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("togtmol:a11y:contrast") === "1";
  });

  useEffect(() => {
    if (eyeSec === null) return;
    if (eyeSec <= 0) {
      engine.chime("break");
      return;
    }
    const id = window.setTimeout(() => setEyeSec((s) => (s ?? 1) - 1), 1000);
    return () => window.clearTimeout(id);
  }, [eyeSec]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty(
      "font-size",
      fontScale === "112" ? "112%" : fontScale === "106" ? "106%" : "100%",
    );
    root.setAttribute("data-high-contrast", highContrast ? "true" : "false");
  }, [fontScale, highContrast]);

  const applyA11y = (nextScale: string, nextContrast: boolean) => {
    setFontScale(nextScale);
    setHighContrast(nextContrast);
    try {
      window.localStorage.setItem("togtmol:a11y:scale", nextScale);
      window.localStorage.setItem(
        "togtmol:a11y:contrast",
        nextContrast ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  };

  const quickDictate = async () => {
    if (!isBrowserSpeechSupported() || dictating) return;
    setDictating(true);
    const sess = new BrowserVoiceSession(
      {
        onFinal: (seg) => {
          const clean = processVoiceTranscript(seg);
          if (captureKind === "task") {
            setFrontOrTitle((p) => (p ? `${p} ${clean}` : clean));
          } else {
            setBodyOrBack((p) => (p ? `${p} ${clean}` : clean));
          }
          sess.stop();
          setDictating(false);
        },
        onStateChange: (on) => setDictating(on),
        onError: () => setDictating(false),
      },
      "mn-MN",
    );
    await sess.start("mn-MN");
  };

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstSubj =
      data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ?? null;

    if (captureKind === "task") {
      if (!frontOrTitle.trim()) return;
      await store.mutate(
        (d) => {
          let next = d;
          let subj = next.subjects.find((s) => !s.deletedAt && !s.archived);
          if (!subj) {
            next = actions.addSubject("Ерөнхий сургалт", "#a78bfa")(next);
            subj = next.subjects.find((s) => !s.deletedAt && !s.archived);
          }
          if (!subj) return next;
          return actions.addTask({
            subjectId: subj.id,
            date: today,
            minutes: 25,
            title: frontOrTitle.trim(),
            startTime: null,
          })(next);
        },
        { reportError: false, reportBusy: false },
      );
      setSavedMsg("Өнөөдрийн даалгаварт нэмлээ! ✓");
    } else if (captureKind === "note") {
      if (!bodyOrBack.trim() && !frontOrTitle.trim()) return;
      const note: StudyNote = {
        ...recordBase(
          frontOrTitle.trim() ||
            bodyOrBack.trim().slice(0, 40) ||
            "Түргэн тэмдэглэл",
          firstSubj,
        ),
        kind: "note",
        date: today,
        body: bodyOrBack.trim() || frontOrTitle.trim(),
        tags: ["quick"],
        image: null,
        links: [],
      };
      await store.mutate(saveKnowledge(note), {
        reportError: false,
        reportBusy: false,
      });
      setSavedMsg("Мэдлэгийн санд тэмдэглэл хадгаллаа! ✓");
    } else {
      if (!frontOrTitle.trim() || !bodyOrBack.trim()) return;
      let targetDeck = data.knowledge.find(
        (r): r is FlashcardDeck => r.kind === "deck" && !r.deletedAt,
      );
      await store.mutate(
        (d) => {
          let next = d;
          if (!targetDeck) {
            const newDeck: FlashcardDeck = {
              ...recordBase("Түргэн давтлагын багц", firstSubj),
              id: uid("deck"),
              kind: "deck",
              description: "Quick Tools-оор үүсгэсэн картууд",
              sourceId: null,
            };
            targetDeck = newDeck;
            next = saveKnowledge(newDeck)(next);
          }
          const newCard = {
            ...recordBase(frontOrTitle.trim().slice(0, 140), firstSubj),
            id: uid("card"),
            kind: "card" as const,
            deckId: targetDeck.id,
            front: frontOrTitle.trim(),
            back: bodyOrBack.trim(),
            schedule: {
              repetitions: 0,
              interval: 0,
              ease: 2.5,
              dueOn: today,
            },
          };
          return addCards([newCard])(next);
        },
        { reportError: false, reportBusy: false },
      );
      setSavedMsg("Шинэ флашкарт үүсгэж хадгаллаа! ✓");
    }

    setFrontOrTitle("");
    setBodyOrBack("");
    setTimeout(() => setSavedMsg(""), 2500);
  };

  return (
    <Modal title="⚡ Оюутны Түргэн Хэрэгсэл & Хүртээмж" onClose={onClose}>
      <div className="space-y-4">
        <div
          className="flex gap-1.5 overflow-x-auto rounded-2xl bg-black/25 p-1.5 ring-1 ring-white/10"
          role="tablist"
        >
          {[
            { id: "capture", icon: Zap, label: "Бичих" },
            { id: "vocab", icon: Languages, label: "Толь" },
            { id: "eye", icon: Eye, label: "Нүд 20-20" },
            { id: "a11y", icon: Accessibility, label: "Хүртээмж" },
            { id: "keys", icon: Keyboard, label: "Товчлуур" },
          ].map((item) => {
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id as typeof tab)}
                className={`flex min-h-[38px] flex-1 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-[11.5px] font-bold transition ${
                  tab === item.id
                    ? "bg-amber-400 text-slate-950"
                    : "text-white/75 hover:bg-white/10"
                }`}
              >
                <IconComp size={13} /> {item.label}
              </button>
            );
          })}
        </div>

        {/* 1B. VOCAB HELPER */}
        {tab === "vocab" && <VocabHelper />}

        {/* 1. QUICK CAPTURE */}
        {tab === "capture" && (
          <form onSubmit={(e) => void handleQuickSave(e)} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="segmented flex-1">
                <button
                  type="button"
                  aria-pressed={captureKind === "note"}
                  onClick={() => setCaptureKind("note")}
                >
                  📝 Тэмдэглэл
                </button>
                <button
                  type="button"
                  aria-pressed={captureKind === "task"}
                  onClick={() => setCaptureKind("task")}
                >
                  ✅ Даалгавар
                </button>
                <button
                  type="button"
                  aria-pressed={captureKind === "card"}
                  onClick={() => setCaptureKind("card")}
                >
                  🃏 Флашкарт
                </button>
              </div>
              <button
                type="button"
                onClick={() => void quickDictate()}
                title="Дуу хоолойгоор бичих"
                className={`rounded-xl px-3 py-2 text-xs font-bold ring-1 ${
                  dictating
                    ? "bg-red-500 text-white ring-red-400"
                    : "bg-white/10 ring-white/15 hover:bg-white/15"
                }`}
              >
                <Mic size={14} />
              </button>
            </div>

            <label className="block space-y-1 text-xs font-semibold">
              <span>
                {captureKind === "card"
                  ? "Асуулт (Нүүр тал)"
                  : captureKind === "task"
                    ? "Өнөөдөр хийх ажил"
                    : "Гарчиг (заавал биш)"}
              </span>
              <input
                type="text"
                required={captureKind !== "note"}
                value={frontOrTitle}
                onChange={(e) => setFrontOrTitle(e.target.value)}
                placeholder={
                  captureKind === "card"
                    ? "Жишээ: Фотосинтез гэж юу вэ?"
                    : captureKind === "task"
                      ? "Жишээ: Математик 3 бодлого бодох"
                      : "Лекцийн гол санаа…"
                }
              />
            </label>

            {captureKind !== "task" && (
              <label className="block space-y-1 text-xs font-semibold">
                <span>
                  {captureKind === "card" ? "Хариулт (Ар тал)" : "Агуулга"}
                </span>
                <textarea
                  rows={3}
                  required
                  value={bodyOrBack}
                  onChange={(e) => setBodyOrBack(e.target.value)}
                  placeholder={
                    captureKind === "card"
                      ? "Гэрлийн энергийг химийн энергид хувиргах үйл явц…"
                      : "Уншсан зүйлээ өөрийн үгээр буулгаарай…"
                  }
                />
              </label>
            )}

            {savedMsg && (
              <p
                role="status"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200"
              >
                <Check size={14} /> {savedMsg}
              </p>
            )}

            <button
              type="submit"
              className="button primary full flex items-center justify-center gap-1.5"
            >
              <Plus size={15} /> Шууд хадгалах
            </button>
          </form>
        )}

        {/* 2. 20-20-20 EYE REST */}
        {tab === "eye" && (
          <div className="space-y-3 rounded-2xl bg-white/5 p-4 text-center ring-1 ring-white/10">
            <div className="text-3xl font-extrabold tabular-nums text-amber-300">
              {eyeSec === null
                ? "20 сек"
                : eyeSec === 0
                  ? "🎉 Нүд амарлаа!"
                  : `${eyeSec} сек`}
            </div>
            <p className="text-xs leading-relaxed opacity-85">
              <b>20-20-20 Дүрэм:</b> Дэлгэц рүү 20 минут харсны дараа 6 метр (20
              фут) хол байгаа зүйл рүү <b>20 секунд</b> ширтэж нүдний булчингаа
              суллаарай.
            </p>
            <button
              type="button"
              onClick={() => {
                engine.breathTone("in");
                setEyeSec(20);
              }}
              className="button primary"
            >
              👀 20 секундийн амралт эхлүүлэх
            </button>
          </div>
        )}

        {/* 3. ACCESSIBILITY */}
        {tab === "a11y" && (
          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <div className="font-bold">Үсгийн хэмжээ (Font Scale)</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "100", label: "Стандарт (100%)" },
                  { id: "106", label: "Томруулсан (106%)" },
                  { id: "112", label: "Уншихад том (112%)" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyA11y(opt.id, highContrast)}
                    className={`rounded-xl py-2.5 font-bold ring-1 ${
                      fontScale === opt.id
                        ? "bg-amber-400 text-slate-950 ring-amber-300"
                        : "bg-white/5 ring-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
              <span>
                <strong className="block">
                  Өндөр тодосголтой хүрээ (High Contrast)
                </strong>
                <small className="opacity-65">
                  Шилэн картуудын хүрээ болон текстийн ялгарлыг нэмэгдүүлнэ
                </small>
              </span>
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(e) => applyA11y(fontScale, e.target.checked)}
              />
            </label>
          </div>
        )}

        {/* 4. SHORTCUTS */}
        {tab === "keys" && (
          <div className="space-y-2 text-xs">
            {[
              ["Alt + V", "Дуу хоолойн удирдлага (Voice FlowBar) нээх/хаах"],
              ["Alt + K", "Түргэн хэрэгсэл ба тэмдэглэл нээх"],
              ["Space (Өрөөн дээр)", "Фокус цаг эхлүүлэх / түр зогсоох"],
              ["“Фокус эхэл”", "Дуу хоолойгоор таймер эхлүүлэх"],
              ["“Бороо асаа”", "Бороотой Кафе орчны дууг идэвхжүүлэх"],
              ["“Даалгавар нэм: …”", "Өнөөдрийн жагсаалтад шууд ажил нэмэх"],
            ].map(([k, desc]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
              >
                <code className="rounded-md bg-amber-400/20 px-2 py-0.5 font-bold text-amber-200">
                  {k}
                </code>
                <span className="text-right opacity-80">{desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
