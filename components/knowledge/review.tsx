"use client";
import { useEffect, useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { Modal } from "@/components/ui/common";
import { knowledgeIndex, newCardsPerDay } from "@/lib/knowledge/index";
import {
  SESSION_MINUTES,
  formatClock,
  remainingMs,
  reviewSessionLimit,
  reviewSessionQueue,
} from "@/lib/knowledge/session";
import {
  reviewCard,
  gradeQuiz,
  saveQuizAttempt,
  recordBase,
  addCards,
  saveKnowledge,
} from "@/lib/knowledge/actions";
import type {
  Flashcard,
  FlashcardDeck,
  QuizAttempt,
  StudyQuiz,
} from "@/types/knowledge";
const GRADES = [
  "0 · Санасангүй",
  "1 · Харсны дараа танилаа",
  "2 · Буруу саналаа",
  "3 · Хэцүү байлаа",
  "4 · Бодож саналаа",
  "5 · Шууд саналаа",
];
export function CardReview({
  deckId,
  subjectId,
  onClose,
}: {
  deckId?: string;
  subjectId?: string;
  onClose: () => void;
}) {
  const { data, store, run, today } = useStudy(),
    { busy } = useStoreState();
  const limit = reviewSessionLimit(data.settings),
    decks = data.knowledge.filter(
      (r): r is FlashcardDeck =>
        r.kind === "deck" &&
        !r.deletedAt &&
        (!subjectId || r.subjectId === subjectId),
    );
  const buildQueue = (value: string) =>
    reviewSessionQueue(data.knowledge, today, data.settings, {
      deckId: value || undefined,
      subjectId,
    }).map((c) => c.id);
  const [deck, setDeck] = useState(deckId ?? ""),
    [queue, setQueue] = useState(() => buildQueue(deckId ?? "")),
    [answer, setAnswer] = useState(false),
    [completed, setCompleted] = useState(0),
    [minutes, setMinutes] = useState<number>(0),
    [deadline, setDeadline] = useState<number | null>(null),
    [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const remaining = remainingMs(deadline, clock),
    timeUp = remaining !== null && remaining <= 0;
  const card = data.knowledge.find(
    (r): r is Flashcard =>
      r.id === queue[0] && r.kind === "card" && !r.deletedAt,
  );
  const grade = async (n: number) => {
    if (!card) return;
    if (
      await run(() =>
        store.mutate(
          reviewCard(card.id, n, card.updatedAt, Date.now(), undefined, today),
        ),
      )
    ) {
      setQueue((q) => (n < 4 ? [...q.slice(1), q[0]] : q.slice(1)));
      if (n >= 4) setCompleted((v) => v + 1);
      setAnswer(false);
    }
  };
  return (
    <Modal title="Өнөөдрийн давтлага" onClose={onClose}>
      <div className="review-session">
        <div className="review-meta">
          <span>{completed} карт давтсан</span>
          <span>{queue.length} үлдсэн</span>
          {remaining !== null && (
            <span
              className={timeUp ? "review-time up" : "review-time"}
              aria-live="polite"
            >
              {timeUp ? "Цаг дууслаа" : `Үлдсэн ${formatClock(remaining)}`}
            </span>
          )}
        </div>
        <div className="review-controls">
          <label>
            Багц
            <select
              value={deck}
              disabled={busy}
              onChange={(e) => {
                setDeck(e.target.value);
                setQueue(buildQueue(e.target.value));
                setAnswer(false);
              }}
            >
              <option value="">Бүх багц</option>
              {decks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Хугацаа
            <select
              value={minutes}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMinutes(value);
                setClock(Date.now());
                setDeadline(value > 0 ? Date.now() + value * 60000 : null);
              }}
            >
              {SESSION_MINUTES.map((value) => (
                <option key={value} value={value}>
                  {value ? `${value} минут` : "Хязгааргүй"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {timeUp && queue.length > 0 && (
          <div className="error-banner" role="status">
            <p>
              Цаг дууслаа. Үргэлжлүүлэх эсвэл өнөөдрийн давтлагыг дуусгаарай.
            </p>
            <div className="button-row">
              <button
                type="button"
                className="button small"
                onClick={() => {
                  setClock(Date.now());
                  setDeadline(Date.now() + 10 * 60000);
                }}
              >
                10 минут нэмэх
              </button>
              <button
                type="button"
                className="button small primary"
                onClick={onClose}
              >
                Дуусгах
              </button>
            </div>
          </div>
        )}
        {card ? (
          <>
            <p className="eyebrow">ЭХЛЭЭД ӨӨРӨӨ САНААРАЙ</p>
            <h2 className="flashcard-front">{card.front}</h2>
            {answer ? (
              <>
                <div className="flashcard-answer">{card.back}</div>
                <p className="tiny muted">
                  Хэр санаснаа үнэлээрэй. Дараагийн давтлагын өдөр үүнд
                  тулгуурлана.
                </p>
                <div className="review-grades">
                  {GRADES.map((label, i) => (
                    <button
                      key={i}
                      disabled={busy}
                      className="button"
                      onClick={() => void grade(i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                className="button primary large"
                onClick={() => setAnswer(true)}
              >
                Хариулт харах
              </button>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setQueue((q) => q.slice(1));
                setAnswer(false);
              }}
            >
              Одоохондоо алгасах
            </button>
          </>
        ) : queue.length ? (
          <>
            <p>Энэ карт өөрчлөгдсөн эсвэл хогийн саванд орсон байна.</p>
            <button
              className="button"
              onClick={() => setQueue((q) => q.slice(1))}
            >
              Дараагийн карт
            </button>
          </>
        ) : (
          <>
            <div className="completion-symbol">✓</div>
            <h2>
              {completed
                ? "Өнөөдөр мэдлэгээ бататгалаа."
                : "Одоохондоо давтах карт алга."}
            </h2>
            <p>
              Дараагийн давтлагын өдрүүд хадгалагдсан. Хүссэн үедээ эргэн
              ирээрэй.
            </p>
            <button className="button primary" onClick={onClose}>
              Дуусгах
            </button>
          </>
        )}
        <p className="tiny muted">
          {data.settings.extras.srsAlgorithm === "fsrs" ? "FSRS" : "SM-2"}{" "}
          хуваарь · Энэ удаа {limit ? `${limit} хүртэл` : "бүх"} карт. 4-өөс
          доош үнэлсэн карт энэ давтлага дотор дахин гарна. Завсарлахад түүх
          хадгалагдана.
        </p>
        <p className="tiny muted">
          {newCardsPerDay(data.settings)
            ? `Өдөрт ${newCardsPerDay(data.settings)} шинэ карт нээгдэнэ (Тохиргоо → «Давтлагын алгоритм»).`
            : "Шинэ картын өдрийн хязгааргүй."}
        </p>
      </div>
    </Modal>
  );
}
export function QuizSession({
  quiz,
  onClose,
}: {
  quiz: StudyQuiz;
  onClose: () => void;
}) {
  const { data, store, run, today } = useStudy(),
    { busy } = useStoreState();
  const quizRetry = knowledgeIndex(data.knowledge, today, data.settings)
    .quizRetryQueue.filter((item) => item.quizId === quiz.id)
    .map((item) => item.question);
  const retryIds = new Set(quiz.questions.map((q) => q.id));
  const retryQuestions = quizRetry.filter((q) => !retryIds.has(q.id));
  const practiceQuiz: StudyQuiz =
    retryQuestions.length > 0
      ? {
          ...quiz,
          questions: [...quiz.questions, ...retryQuestions],
        }
      : quiz;
  const [responses, setResponses] = useState<Record<string, string>>({}),
    [result, setResult] = useState<QuizAttempt | null>(null),
    [savedCards, setSavedCards] = useState(false);
  const submit = async () => {
    const attempt = gradeQuiz(practiceQuiz, responses);
    attempt.date = today;
    if (
      await run(
        () => store.mutate(saveQuizAttempt(attempt, quiz.updatedAt)),
        "Сорилын үр дүн хадгалагдлаа.",
      )
    )
      setResult(attempt);
  };
  const wrongToCards = async () => {
    if (!result) return;
    const deck = {
      ...recordBase(
        `${quiz.title.slice(0, 140)} · Давтах`,
        quiz.subjectId,
        quiz.tags,
      ),
      kind: "deck" as const,
      description: "Сорилын буруу хариултаас үүсгэсэн картууд",
    };
    const cards: Flashcard[] = result.answers
      .filter((a) => !a.correct)
      .map((a) => ({
        ...recordBase(
          a.question.prompt.slice(0, 180),
          quiz.subjectId,
          quiz.tags,
        ),
        kind: "card",
        deckId: deck.id,
        front: a.question.prompt,
        back: `${a.question.answer}${a.question.explanation ? `\n\n${a.question.explanation}` : ""}`,
        schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: today },
      }));
    if (
      await run(
        () => store.mutate((d) => addCards(cards)(saveKnowledge(deck)(d))),
        "Алдаагаа давтах картууд хадгаллаа.",
      )
    )
      setSavedCards(true);
  };
  return (
    <Modal title={quiz.title} onClose={onClose}>
      {practiceQuiz.questions.length > quiz.questions.length && !result && (
        <div className="ai-consent">
          <strong>🔁 Өмнөх алдаатай асуулт</strong>
          <p className="tiny muted">
            Энэ quiz-ийн өмнөх буруу хариултуудыг автоматаар дахин орууллаа. Зөв
            хариулсны дараа дахин жагсаалтад орохгүй.
          </p>
        </div>
      )}
      {result ? (
        <div className="form-stack">
          <div className="quiz-score">
            {result.score}
            <small> / {result.total}</small>
          </div>
          <p>
            {result.score} зөв · {result.total - result.score} дахин харах
          </p>
          {result.answers.map((a, i) => (
            <article
              className={`quiz-result ${a.correct ? "correct" : "incorrect"}`}
              key={a.question.id}
            >
              <h3>
                {i + 1}. {a.question.prompt}
              </h3>
              <p>Таны хариулт: {a.response || "Хоосон"}</p>
              {!a.correct && (
                <p>
                  <strong>Зөв хариулт: {a.question.answer}</strong>
                </p>
              )}
              {a.question.explanation && <p>{a.question.explanation}</p>}
            </article>
          ))}
          {result.score < result.total && (
            <button
              className="button primary"
              disabled={busy || savedCards}
              onClick={() => void wrongToCards()}
            >
              {savedCards
                ? "Давтах багц үүссэн"
                : "Буруу хариултуудаар карт үүсгэх"}
            </button>
          )}
          <button className="button" onClick={onClose}>
            Хаах
          </button>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="tiny muted">
            Богино хариултад том, жижиг үсэг болон илүү зайг ялгахгүй. Утга
            ойролцоо хариултыг автоматаар дүгнэхгүй.
          </p>
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}. {q.prompt}
              </legend>
              {q.type === "short" ? (
                <label>
                  Хариулт
                  <input
                    required
                    value={responses[q.id] ?? ""}
                    onChange={(e) =>
                      setResponses((v) => ({ ...v, [q.id]: e.target.value }))
                    }
                  />
                </label>
              ) : (
                (q.type === "boolean" ? ["Үнэн", "Худал"] : q.options).map(
                  (option) => (
                    <label className="check-label" key={option}>
                      <input
                        type="radio"
                        required
                        name={q.id}
                        value={option}
                        checked={responses[q.id] === option}
                        onChange={() =>
                          setResponses((v) => ({ ...v, [q.id]: option }))
                        }
                      />
                      {option}
                    </label>
                  ),
                )
              )}
            </fieldset>
          ))}
          <button
            className="button primary"
            disabled={
              busy ||
              !data.knowledge.some((r) => r.id === quiz.id && !r.deletedAt)
            }
          >
            Хариултаа шалгах
          </button>
        </form>
      )}
    </Modal>
  );
}
