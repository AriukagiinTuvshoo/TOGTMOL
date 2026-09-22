"use client";
import { useEffect, useRef } from "react";

export function TimerAlert({
  complete,
  message,
  onStop,
  onReview,
}: {
  complete: boolean;
  message: string;
  onStop: () => void;
  onReview: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`timer-alert-dialog timer-alert-${complete ? "complete" : "warning"}`}
      aria-labelledby="timer-alert-title"
      aria-describedby="timer-alert-description"
      onCancel={(event) => {
        event.preventDefault();
        onStop();
      }}
    >
      <section className="timer-alert-card">
        <div className="timer-alert-icon" aria-hidden="true">
          {complete ? "⏰" : "🔔"}
        </div>
        <p className="timer-alert-kicker">
          {complete ? "ХУГАЦАА ДУУССАН" : "САНУУЛГА"}
        </p>
        <h2 id="timer-alert-title">
          {complete ? "Хугацаа дууслаа!" : message}
        </h2>
        <p id="timer-alert-description">
          {complete
            ? "Хичээлээ дуусгалаа. Үр дүнгээ хадгалаарай."
            : "Таймер үргэлжилж байна."}
        </p>
        <div className="timer-alert-actions">
          <button
            type="button"
            className="button primary large timer-alert-stop"
            onClick={onStop}
            autoFocus
          >
            🔇 Дууг зогсоох
          </button>
          {complete && (
            <button type="button" className="button large" onClick={onReview}>
              Үр дүнгээ харах
            </button>
          )}
        </div>
      </section>
    </dialog>
  );
}
