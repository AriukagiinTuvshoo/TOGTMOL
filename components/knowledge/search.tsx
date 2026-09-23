"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { Modal } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { searchableData, searchResults } from "@/lib/knowledge/index";
export function GlobalSearch() {
  const { data, navigate } = useStudy(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const index = useMemo(() => (open ? searchableData(data) : []), [open, data]),
    deferred = useDeferredValue(query),
    results = searchResults(index, deferred, {}, 40);
  return (
    <>
      <button
        className="global-search-button"
        onClick={() => setOpen(true)}
        aria-label="Хайх"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon name="search" size={18} />
        <span>Хайх</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      {open && (
        <Modal title="Миний орон зайгаас хайх" onClose={() => setOpen(false)}>
          <label className="search-field">
            <Icon name="search" />
            <input
              autoFocus
              aria-label="Бүх мэдээллээс хайх"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Тэмдэглэл, карт, хичээл, зорилго…"
            />
          </label>
          <div className="global-search-results">
            {results.map((r) => (
              <button
                key={`${r.type}:${r.id}`}
                onClick={() => {
                  navigate(r.view, r.id);
                  setOpen(false);
                }}
              >
                <strong>{r.title}</strong>
                <span>{r.detail.slice(0, 150)}</span>
                <small>{r.date}</small>
              </button>
            ))}
            {!results.length && <p>Хайлтад тохирох бичлэг олдсонгүй.</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
