"use client";
import { useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { SectionTitle } from "@/components/ui/common";
import { useI18n } from "@/components/i18n/language-provider";
import { calibrateStabilityScale } from "@/lib/knowledge/calibrate";
import { newCardsPerDay } from "@/lib/knowledge/index";
import {
  MAX_REVIEW_SESSION_LIMIT,
  reviewSessionLimit,
} from "@/lib/knowledge/session";
import type { CardReview } from "@/types/knowledge";

type Algorithm = "sm2" | "fsrs";
const MIN_SAMPLES = 40;

export function ReviewSettings() {
  const { data, store, run } = useStudy(),
    { busy } = useStoreState(),
    { language } = useI18n(),
    en = language === "en",
    [message, setMessage] = useState("");
  const algorithm: Algorithm =
    data.settings.extras.srsAlgorithm === "fsrs" ? "fsrs" : "sm2";
  const scale =
    typeof data.settings.extras.fsrsScale === "number"
      ? data.settings.extras.fsrsScale
      : 1;
  const budget = newCardsPerDay(data.settings),
    [budgetDraft, setBudgetDraft] = useState(String(budget));
  const sessionLimit = reviewSessionLimit(data.settings),
    [limitDraft, setLimitDraft] = useState(String(sessionLimit));
  const saveLimit = () => {
    const value = Number.parseInt(limitDraft, 10);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > MAX_REVIEW_SESSION_LIMIT
    ) {
      setLimitDraft(String(sessionLimit));
      setMessage(
        `Нэг давтлагын дээд хэмжээ 0–${MAX_REVIEW_SESSION_LIMIT} (0 = хязгааргүй).`,
      );
      return;
    }
    if (value === sessionLimit) return;
    setLimitDraft(String(value));
    void run(
      () =>
        store.mutate(
          actions.settings({
            extras: { ...data.settings.extras, reviewSessionLimit: value },
          }),
        ),
      "Нэг давтлагын дээд хэмжээг хадгаллаа.",
    );
  };
  const saveBudget = () => {
    const value = Number.parseInt(budgetDraft, 10);
    if (!Number.isFinite(value) || value < 0 || value > 500) {
      setBudgetDraft(String(budget));
      setMessage("Өдрийн шинэ карт 0–500 хооронд байна (0 = хязгааргүй).");
      return;
    }
    if (value === budget) return;
    setBudgetDraft(String(value));
    void run(
      () =>
        store.mutate(
          actions.settings({
            extras: { ...data.settings.extras, newCardsPerDay: value },
          }),
        ),
      "Өдрийн шинэ картын хязгаарыг хадгаллаа.",
    );
  };
  const reviews = data.knowledge.filter(
    (r): r is CardReview => r.kind === "review" && !r.deletedAt,
  );
  const calibration = calibrateStabilityScale(reviews);

  const choose = (next: Algorithm) =>
    void run(() =>
      store.mutate(
        actions.settings({
          extras: { ...data.settings.extras, srsAlgorithm: next },
        }),
      ),
    );

  const learn = () => {
    const calibrated = calibration;
    if (calibrated.samples < MIN_SAMPLES) {
      setMessage(
        en
          ? `Not enough review history yet: ${calibrated.samples} of ${MIN_SAMPLES} observations. FSRS keeps its defaults.`
          : `Түүх хараахан хүрэлцэхгүй: ${calibrated.samples}/${MIN_SAMPLES} ажиглалт. FSRS анхдагч тохиргоогоор ажиллана.`,
      );
      return;
    }
    if (!calibrated.applied) {
      setMessage(
        en
          ? "Your history matches the defaults, so nothing changed."
          : "Таны түүх анхдагч тохиргоотой нийцэж байна. Өөрчлөлт хийгээгүй.",
      );
      return;
    }
    void run(
      () =>
        store.mutate(
          actions.settings({
            extras: {
              ...data.settings.extras,
              fsrsScale: calibrated.scale,
              fsrsCalibration: {
                scale: calibrated.scale,
                samples: calibrated.samples,
                at: Date.now(),
              },
            },
          }),
        ),
      en ? "FSRS calibration saved." : "FSRS тохируулга хадгалагдлаа.",
    );
    setMessage(
      en
        ? `Learned from ${calibrated.samples} reviews: stability ×${calibrated.scale}.`
        : `${calibrated.samples} давтлагын түүхээс сурав: тогтвортой байдал ×${calibrated.scale}.`,
    );
  };

  return (
    <section className="card">
      <SectionTitle
        title={en ? "Repetition algorithm" : "Давтлагын алгоритм"}
        subtitle={
          en
            ? "SM-2 stays the default. FSRS adapts intervals to your own recall."
            : "SM-2 анхдагч хэвээр. FSRS нь таны санах чадварт тохируулан хуваарь тааруулна."
        }
      />
      <div className="theme-options">
        {(
          [
            ["sm2", "SM-2"],
            ["fsrs", "FSRS"],
          ] as [Algorithm, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={algorithm === id}
            disabled={busy}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="tiny muted">
        {algorithm === "fsrs"
          ? en
            ? "FSRS-4.5 with 0.9 target retention. Grades 0–2 count as a lapse, 3 hard, 4 good, 5 easy. Your review history stays the same; only the next interval changes."
            : "FSRS-4.5, 0.9 хадгалалтын магадлалтай. 0–2 үнэлгээ алдаа, 3 хэцүү, 4 сайн, 5 амархан гэж тооцогдоно. Давтлагын түүх хэвээр; зөвхөн дараагийн хуваарь өөрчлөгдөнө."
          : en
            ? "SM-2: the interval grows from your ease factor. Cards graded 0–2 return tomorrow."
            : "SM-2: интервал таны хялбаршлын коэффициентээр өснө. 0–2 үнэлгээтэй карт маргааш буцаж ирнэ."}
      </p>
      <div className="form-stack">
        <label>
          {en
            ? "New cards per day (0 = no limit)"
            : "Өдөрт шинэ карт (0 = хязгааргүй)"}
          <input
            type="number"
            min={0}
            max={500}
            value={budgetDraft}
            disabled={busy}
            onChange={(e) => setBudgetDraft(e.target.value)}
            onBlur={saveBudget}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveBudget();
              }
            }}
          />
        </label>
        <p className="tiny muted">
          {en
            ? "Imported cards enter the review queue at this pace; overdue cards always show up in full."
            : "Импортолсон картууд энэ хязгаараар өдөр бүр давтлагад орно; хугацаа болсон карт үргэлж бүгд гарна."}
        </p>
        <label>
          {en
            ? `Cards per session (0 = no limit, max ${MAX_REVIEW_SESSION_LIMIT})`
            : `Нэг давтлагын дээд хэмжээ (0 = хязгааргүй, дээд нь ${MAX_REVIEW_SESSION_LIMIT})`}
          <input
            type="number"
            min={0}
            max={MAX_REVIEW_SESSION_LIMIT}
            value={limitDraft}
            disabled={busy}
            onChange={(e) => setLimitDraft(e.target.value)}
            onBlur={saveLimit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveLimit();
              }
            }}
          />
        </label>
        <p className="tiny muted">
          {en
            ? "The session stops offering new cards after this many. You can still filter by deck or set a time box in the review window."
            : "Давтлагын цонх энэ тооноос хэтэрсэн картыг нээхгүй. Цонхон дотор багцаар шүүх, хугацаа тогтоох боломжтой."}
        </p>
        <p className="tiny muted">
          {en
            ? `Stability multiplier: ×${scale}. Observations in your history: ${calibration.samples}.`
            : `Тогтвортой байдлын коэффициент: ×${scale}. Түүх дэх ажиглалт: ${calibration.samples}.`}
        </p>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={learn}
        >
          {en ? "Learn from my history" : "Түүхээс тохируулах"}
        </button>
        {message && (
          <p role="status" className="tiny muted">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
