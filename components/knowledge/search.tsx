"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { Modal } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import type { View } from "@/types/study";
import { searchableData, searchResults } from "@/lib/knowledge/index";

const COMMANDS: {
  id: string;
  label: string;
  hint: string;
  view: View;
  icon: string;
  keywords: string[];
}[] = [
  {
    id: "overview",
    label: "Миний өрөө",
    hint: "Өнөөдрийн хэмнэл, timer, өрөө",
    view: "overview",
    icon: "home",
    keywords: ["нүүр", "өрөө", "өдөр", "home"],
  },
  {
    id: "timer",
    label: "Төвлөрөх цаг",
    hint: "Timer нээх",
    view: "timer",
    icon: "play",
    keywords: ["timer", "focus", "pomodoro", "цаг"],
  },
  {
    id: "knowledge",
    label: "Миний мэдлэг",
    hint: "Тэмдэглэл, карт, сорил",
    view: "knowledge",
    icon: "book",
    keywords: ["мэдлэг", "note", "card", "quiz", "ном"],
  },
  {
    id: "calendar",
    label: "Календарь",
    hint: "Өдрүүд, төлөвлөгөө",
    view: "calendar",
    icon: "calendar",
    keywords: ["календарь", "хуанли", "plan", "өдөр"],
  },
  {
    id: "statistics",
    label: "Статистик",
    hint: "Ахиц, хэмнэл, тоо",
    view: "statistics",
    icon: "chart",
    keywords: ["статистик", "ахиц", "тоо", "stats"],
  },
  {
    id: "goals",
    label: "Зорилго",
    hint: "Суралцах зорилгоо тохируулах",
    view: "goals",
    icon: "target",
    keywords: ["зорилго", "goal", "target"],
  },
  {
    id: "achievements",
    label: "Амжилт",
    hint: "Нээлттэй амжилтуудаа харах",
    view: "achievements",
    icon: "award",
    keywords: ["амжилт", "achievement", "шагнал"],
  },
  {
    id: "assistant",
    label: "Бондоок",
    hint: "Суралцах туслахаа нээх",
    view: "assistant",
    icon: "spark",
    keywords: ["бондоок", "ai", "туслах", "assistant"],
  },
  {
    id: "room",
    label: "Өрөөний загвар",
    hint: "Өрөө, хамтрагч, чимэглэл",
    view: "room",
    icon: "sun",
    keywords: ["өрөө", "theme", "загвар", "чимэглэл"],
  },
  {
    id: "settings",
    label: "Тохиргоо",
    hint: "Timer, дуу, PWA, өгөгдөл",
    view: "settings",
    icon: "settings",
    keywords: ["тохиргоо", "settings", "pwa", "өгөгдөл"],
  },
];

function matchesCommand(command: (typeof COMMANDS)[number], query: string) {
  const text = [command.label, command.hint, ...command.keywords]
    .join(" ")
    .toLocaleLowerCase();
  return text.includes(query.trim().toLocaleLowerCase());
}

export function GlobalSearch() {
  const { data, navigate } = useStudy();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCommand, setActiveCommand] = useState(0);

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

  const index = useMemo(
    () => (open ? searchableData(data) : []),
    [open, data],
  );
  const deferred = useDeferredValue(query);
  const commands = useMemo(
    () => COMMANDS.filter((command) => matchesCommand(command, deferred)),
    [deferred],
  );
  const results = searchResults(index, deferred, {}, 40);

  useEffect(() => {
    setActiveCommand(0);
  }, [deferred]);

  const closePalette = () => {
    setOpen(false);
    setQuery("");
  };

  const runCommand = (command: (typeof COMMANDS)[number]) => {
    navigate(command.view);
    closePalette();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCommand((value) =>
        commands.length ? (value + 1) % commands.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommand((value) =>
        commands.length ? (value - 1 + commands.length) % commands.length : 0,
      );
      return;
    }
    if (event.key === "Enter" && commands[activeCommand]) {
      event.preventDefault();
      runCommand(commands[activeCommand]);
    }
  };

  return (
    <>
      <button
        className="global-search-button"
        onClick={() => setOpen(true)}
        aria-label="Бүх мэдээллээс хайх"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Icon name="search" size={18} />
        <span>Хайх</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      {open && (
        <Modal
          title="Шуурхай команд ба хайлт"
          onClose={closePalette}
        >
          <div className="command-palette-hint">
            <span>⌘K / Ctrl K</span>
            <small>Команд сонгох · ↑↓ шилжих · Enter нээх</small>
          </div>
          <label className="search-field">
            <Icon name="search" />
            <input
              autoFocus
              aria-label="Команд эсвэл мэдээлэл хайх"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Жишээ: timer, календарь, зорилго…"
            />
          </label>

          {commands.length > 0 && (
            <section className="command-palette-section" aria-label="Шуурхай команд">
              <div className="command-palette-section-title">Шуурхай команд</div>
              <div className="command-palette-commands" role="listbox">
                {commands.map((command, index) => (
                  <button
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeCommand}
                    className={
                      index === activeCommand
                        ? "command-palette-command active"
                        : "command-palette-command"
                    }
                    onMouseEnter={() => setActiveCommand(index)}
                    onClick={() => runCommand(command)}
                  >
                    <span className="command-palette-icon" aria-hidden="true">
                      <Icon name={command.icon} size={17} />
                    </span>
                    <span className="command-palette-copy">
                      <strong>{command.label}</strong>
                      <small>{command.hint}</small>
                    </span>
                    {index === activeCommand && <kbd>Enter</kbd>}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section
            className="command-palette-section"
            aria-label="Миний мэдээллээс хайх"
          >
            <div className="command-palette-section-title">Миний мэдээлэл</div>
            <div className="global-search-results">
              {results.map((r) => (
                <button
                  key={r.type + ":" + r.id}
                  onClick={() => {
                    navigate(r.view, r.id);
                    closePalette();
                  }}
                >
                  <strong>{r.title}</strong>
                  <span>{r.detail.slice(0, 150)}</span>
                  <small>{r.date}</small>
                </button>
              ))}
              {!results.length && (
                <p className="command-palette-no-results">
                  Хайлтад тохирох бичлэг алга. Дээрх командаас нэгийг сонгоод
                  шууд нээгээрэй.
                </p>
              )}
            </div>
          </section>
        </Modal>
      )}
    </>
  );
}