// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gradeOralRecall } from "@/lib/voice/oral-grader";
import { MarkdownView } from "@/components/knowledge/markdown-view";
import { computeCoFocusPhase } from "@/components/v9/cofocus-widget";
import { CORE_VOCAB } from "@/components/v9/vocab-helper";
import { AppShell } from "@/components/app-shell";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  window.localStorage.clear();
  window.location.hash = "#/overview";

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => {
  cleanup();
});

describe("TOGTMOL v11 — 6 Improvement Packages & Mobile-First Ergonomics", () => {
  it("grades Oral Recall accurately across Mongolian stems, English, and Japanese", () => {
    const highMn = gradeOralRecall(
      "Термодинамикийн нэгдүгээр хууль нь энерги хадгалагдах хууль юм",
      "Термодинамик нэгдүгээр хууль энерги хадгалагдана",
    );
    expect(highMn.scorePercent).toBeGreaterThanOrEqual(75);
    expect(highMn.suggestedGrade).toBeGreaterThanOrEqual(4);

    const lowMn = gradeOralRecall(
      "Митохондри эсийн гурван гинжит АТФ энерги үүсгэнэ",
      "Улаанбаатар хотын цаг агаар",
    );
    expect(lowMn.scorePercent).toBeLessThan(30);
    expect(lowMn.suggestedGrade).toBe(1);
    expect(lowMn.missingKeywords.length).toBeGreaterThan(0);

    const jaMatch = gradeOralRecall("集中と復習", "集中と復習します");
    expect(jaMatch.scorePercent).toBe(100);
    expect(jaMatch.suggestedGrade).toBe(5);
  });

  it("renders inline & display LaTeX math formulas and fenced code blocks in MarkdownView", () => {
    render(
      <MarkdownView
        body={[
          "# Физик ба Код",
          "Эйнштейний томьёо: $E = mc^{2}$ болон $\\alpha + \\beta \\leq \\pi$.",
          "$$\\frac{a+b}{2} = \\sqrt{x_{1}}$$",
          "```python",
          "def focus_score(mins):",
          "    return mins * 2",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("Физик ба Код")).toBeInTheDocument();
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.getByText(/def focus_score/)).toBeInTheDocument();
    expect(document.querySelector(".math-inline")).toBeTruthy();
    expect(document.querySelector(".math-block")).toBeTruthy();
  });

  it("computes deterministic 25m/5m Co-Focus phase synchronization", () => {
    const startOfCycle = 30 * 60 * 1000 * 100; // exact 30m boundary
    const focusSnap = computeCoFocusPhase(startOfCycle + 5 * 60 * 1000);
    expect(focusSnap.phase).toBe("focus");
    expect(focusSnap.remainingSec).toBe(20 * 60);

    const breakSnap = computeCoFocusPhase(startOfCycle + 27 * 60 * 1000);
    expect(breakSnap.phase).toBe("break");
    expect(breakSnap.remainingSec).toBe(3 * 60);
  });

  it("provides MN-EN-JA core vocabulary entries with readings and examples", () => {
    expect(CORE_VOCAB.length).toBeGreaterThanOrEqual(8);
    expect(CORE_VOCAB.some((v) => v.ja.includes("集中"))).toBe(true);
  });

  it("renders Mobile Quick-Nav toolbar, Co-Focus room, Exam Countdown, Cozy Shelf & Cloud Backup", async () => {
    render(<AppShell />);

    // Wait for IndexedDB hydration
    const mobileToolbar = await screen.findByRole("toolbar", {
      name: "Гар утасны хурдан шилжилт",
    });
    expect(within(mobileToolbar).getByText("Миний өрөө")).toBeInTheDocument();
    expect(within(mobileToolbar).getByText("Бондоок")).toBeInTheDocument();

    // Study Room v11 cards: Co-Focus, Exam Countdown, Cozy Shelf
    expect(
      await screen.findByText("Найзтайгаа зэрэг төвлөрөх"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Шалгалтын тоолол ба өдрийн норм"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ширээний цуглуулга/)).toBeInTheDocument();

    // Open Co-Focus room with 1 tap
    fireEvent.click(screen.getByRole("button", { name: /Шинэ өрөө нээх/i }));
    expect(screen.getByRole("button", { name: /Урих/i })).toBeInTheDocument();

    // Open Auth Modal -> verify 1-tap Google Drive / Phone backup section
    fireEvent.click(screen.getByRole("button", { name: "Нэвтрэх ба бүртгэл" }));
    expect(
      await screen.findByText(/Google Drive \/ Утас хооронд 1-товчоор нөөцлөх/),
    ).toBeInTheDocument();
  });
});
