"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./icon";
import { useStudy } from "@/hooks/use-study";
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Icon name="leaf" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Metric({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  foot?: string;
  icon?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon && <Icon name={icon} size={18} />}
      </div>
      <strong>{value}</strong>
      {foot && <span>{foot}</span>}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function SubjectSelect({
  value,
  onChange,
  all = false,
  required = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  all?: boolean;
  required?: boolean;
  id?: string;
}) {
  const { data } = useStudy();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-label="Хичээл"
    >
      {all ? (
        <option value="">Бүх хичээл</option>
      ) : (
        <option value="">Хичээл сонгох</option>
      )}
      {data.subjects
        .filter((s) => !s.deletedAt)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.archived ? " · архив" : ""}
          </option>
        ))}
    </select>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-label={title}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Хаах">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
