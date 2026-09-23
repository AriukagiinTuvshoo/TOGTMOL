// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { Repository } from "@/lib/persistence/repository";
import { AppShell } from "@/components/app-shell";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  window.scrollTo = vi.fn();
  window.confirm = vi.fn().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("interactive local workflow", () => {
  it("creates a subject, measures paused study, reviews and saves the result with a note", async () => {
    let now = new Date("2026-09-15T12:00:00").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    const nav = screen.getByRole("navigation", { name: "Үндсэн цэс" });
    fireEvent.click(within(nav).getByRole("button", { name: "Хичээлүүд" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Анхны хичээлээ нэмэх" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Хичээлийн нэр" }), {
      target: { value: "Код бичих" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Хадгалах",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Гар утасны цэс" }),
      ).getByRole("button", { name: "Төвлөрөх" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start study" }));
    await screen.findByRole("button", { name: "Pause" });
    now += 10000;
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await screen.findByRole("button", { name: "Resume" });
    now += 30000;
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await screen.findByRole("button", { name: "Pause" });
    fireEvent.click(screen.getByRole("button", { name: "Тэмдэглэл бичих" }));
    fireEvent.change(screen.getByLabelText("Юу сурсан бэ?"), {
      target: { value: "Рекурс ойлголоо" },
    });
    // Navigation before the debounce flush must retain the exact note.
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(within(nav).getByRole("button", { name: "Миний өрөө" }));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Гар утасны цэс" }),
      ).getByRole("button", { name: "Төвлөрөх" }),
    );
    expect(screen.getByLabelText("Юу сурсан бэ?")).toHaveValue(
      "Рекурс ойлголоо",
    );
    now += 15000;
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    const saveButton = await screen.findByRole("button", {
      name: "Save result",
    });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    await waitFor(async () => {
      const checkRepo = new Repository(indexedDB, localStorage);
      const check = await checkRepo.load("guest");
      await checkRepo.close();
      expect(check?.data.activeTimer).toBeNull();
      expect(check?.data.sessions).toHaveLength(1);
    });
    const repo = new Repository(indexedDB, localStorage),
      saved = await repo.load("guest");
    expect(saved?.data.sessions).toHaveLength(1);
    expect(saved?.data.sessions[0]).toMatchObject({
      durationSec: 25,
      note: "Рекурс ойлголоо",
      startEpoch: now - 55000,
    });
    expect(saved?.data.activeTimer).toBeNull();
    await repo.close();
    fireEvent.click(within(nav).getByRole("button", { name: "Миний өрөө" }));
    expect(await screen.findByText(/Рекурс ойлголоо/)).toBeVisible();
  }, 20000);
  it("renders all navigation surfaces with real empty states and persistent theme changes", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    const nav = screen.getByRole("navigation", { name: "Үндсэн цэс" });
    fireEvent.click(within(nav).getByRole("button", { name: "Статистик" }));
    expect(
      await screen.findByText("Тогтмол байдал", { exact: true }),
    ).toBeVisible();
    fireEvent.click(within(nav).getByRole("button", { name: "Календарь" }));
    expect(await screen.findByRole("tab", { name: /Сар/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /7 хоног/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: /Өдөр/ })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /7 хоног/ }));
    expect(await screen.findByText(/таны суралцах хуваарь/i)).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /Өдөр/ }));
    expect(screen.getByText(/timeline/i)).toBeVisible();
    fireEvent.click(within(nav).getByRole("button", { name: "Тохиргоо" }));
    fireEvent.click(await screen.findByRole("button", { name: "Бараан" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(screen.getByText("Локал горим бэлэн")).toBeVisible();
  });
});

describe("study world integration", () => {
  it("saves a full theme and room customization across reloads", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    fireEvent.click(screen.getByRole("button", { name: "Өрөөгөө өөрчлөх" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Бусад өрөө (6)" }),
    );
    const sakura = await screen.findByRole("button", { name: /Sakura/ });
    fireEvent.click(sakura);
    await waitFor(() =>
      expect(document.documentElement.dataset.design).toBe("sakura"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Арын орчин" }), {
      target: { value: "hokkaido" },
    });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Арын орчин" })).toHaveValue(
        "hokkaido",
      ),
    );
    const repo = new Repository(indexedDB, localStorage);
    await waitFor(async () =>
      expect((await repo.load("guest"))?.data.settings.world).toMatchObject({
        design: "sakura",
        companion: "rabbit",
        background: "hokkaido",
      }),
    );
    await repo.close();
    cleanup();
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    expect(document.documentElement.dataset.design).toBe("sakura");
  });
  it("starts a goal task in focus mode and saves real progress through the shared timer", async () => {
    let now = new Date("2026-09-15T12:00:00").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { fixture } = await import("./fixtures"),
      repo = new Repository(indexedDB, localStorage);
    await repo.save("guest", { ...fixture(), sessions: [] }, 0);
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    const nav = screen.getByRole("navigation", { name: "Үндсэн цэс" });
    fireEvent.click(within(nav).getByRole("button", { name: "Зорилго" }));
    fireEvent.click(screen.getByRole("button", { name: "Шинэ зорилго" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Таны зорилго" }), {
      target: { value: "Математик 1 долоо хоног 25 минут" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Алхмуудын санал гаргах" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Хуваарийг урьдчилж харах" }),
    );
    expect((await repo.load("guest"))?.data.studyGoals).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Энэ төлөвлөгөөг хадгалах" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /дараагийн алхам эхлүүлэх/ }),
    );
    await screen.findByRole("button", { name: "Focus-оос гарах" });
    expect(document.querySelector(".app-shell")).toHaveClass("is-focus");
    now += 30000;
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await screen.findByRole("button", { name: "Resume" });
    now += 60000;
    fireEvent.keyDown(window, { key: "Escape" });
    await screen.findByRole("button", { name: "Өрөөгөө өөрчлөх" });
    expect(document.querySelector(".app-shell")).not.toHaveClass("is-focus");
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await screen.findByRole("button", { name: "Save result" });
    fireEvent.change(screen.getByLabelText("Юу сурсан бэ?"), {
      target: { value: "Хоёр жишээ бодлоо" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    await waitFor(async () => {
      const d = (await repo.load("guest"))!.data;
      expect(d.sessions).toHaveLength(1);
      expect(d.sessions[0].durationSec).toBe(30);
      expect(d.sessions[0].extras.goalId).toBe(d.studyGoals[0].id);
      expect(d.sessions[0].note).toBe("Хоёр жишээ бодлоо");
    });
    await repo.close();
  });
  it("keeps the music panel mounted across navigation and never loads YouTube by default", async () => {
    const audio = vi.fn();
    vi.stubGlobal("AudioContext", audio);
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    const player = screen.getByRole("complementary", { name: "Study music" });
    expect(audio).not.toHaveBeenCalled();
    expect(document.querySelector('script[src*="youtube"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Хөгжим нээх" }));
    expect(
      await screen.findByRole("button", { name: /Rainy window/ }),
    ).toBeVisible();
    const nav = screen.getByRole("navigation", { name: "Үндсэн цэс" });
    fireEvent.click(within(nav).getByRole("button", { name: "Календарь" }));
    expect(screen.getByRole("complementary", { name: "Study music" })).toBe(
      player,
    );
    expect(screen.getByRole("button", { name: /Rainy window/ })).toBeVisible();
    fireEvent.change(
      screen.getByRole("textbox", { name: "YouTube video эсвэл playlist" }),
      { target: { value: "https://evil.example/video" } },
    );
    fireEvent.click(within(player).getByRole("button", { name: "Нэмэх" }));
    expect(await screen.findByText(/Зөвхөн YouTube-ийн/)).toBeVisible();
    expect(document.querySelector('script[src*="youtube"]')).toBeNull();
    expect(audio).not.toHaveBeenCalled();
  });
});

it("uses the official YouTube API without autoplay and retains it when minimizing", async () => {
  const play = vi.fn(),
    pause = vi.fn(),
    destroy = vi.fn(),
    optionsSeen: Record<string, unknown>[] = [];
  let state: ((s: number) => void) | undefined;
  class Player {
    constructor(element: HTMLElement, options: Record<string, unknown>) {
      optionsSeen.push(options);
      const callbacks = options.events as {
        onReady: (e: { target: Player }) => void;
        onStateChange: (e: { data: number }) => void;
      };
      state = (s) => callbacks.onStateChange({ data: s });
      const iframe = document.createElement("iframe");
      iframe.title = "YouTube";
      element.replaceWith(iframe);
      queueMicrotask(() => callbacks.onReady({ target: this }));
    }
    playVideo() {
      play();
      state?.(1);
    }
    pauseVideo() {
      pause();
      state?.(2);
    }
    stopVideo() {
      state?.(0);
    }
    setVolume() {}
    mute() {}
    unMute() {}
    nextVideo() {}
    previousVideo() {}
    getPlayerState() {
      return 2;
    }
    destroy() {
      destroy();
    }
  }
  window.YT = { Player };
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
  fireEvent.click(screen.getByRole("button", { name: "Хөгжим нээх" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "YouTube video эсвэл playlist" }),
    { target: { value: "https://www.youtube.com/watch?v=abcdefghijk" } },
  );
  fireEvent.click(
    within(
      screen.getByRole("complementary", { name: "Study music" }),
    ).getByRole("button", { name: "Нэмэх" }),
  );
  await screen.findByTitle("YouTube");
  await waitFor(() => expect(optionsSeen).toHaveLength(1));
  expect(optionsSeen[0].playerVars).toMatchObject({
    autoplay: 0,
    controls: 1,
    playsinline: 1,
  });
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Хөгжим тоглуулах" }));
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Хөгжим багасгах" }));
  expect(destroy).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  expect(screen.getByTitle("YouTube")).toBeVisible();
  delete window.YT;
});

it("edits a daily task and reports its actual completion day in the calendar", async () => {
  const { fixture } = await import("./fixtures");
  const { dateKey } = await import("@/lib/calculations/dates");
  const { actions } = await import("@/lib/persistence/actions");
  const day = dateKey(),
    repo = new Repository(indexedDB, localStorage);
  const data = actions.addTask({
    subjectId: "math",
    date: day,
    minutes: 25,
    title: "Жишээ бодох",
    startTime: null,
  })(fixture());
  await repo.save("guest", data, 0);
  render(<AppShell />);
  await screen.findByRole("button", { name: "Жишээ бодох засах" });
  fireEvent.click(screen.getByRole("button", { name: "Жишээ бодох засах" }));
  fireEvent.change(screen.getByLabelText("Юу хийх вэ?"), {
    target: { value: "Гурван жишээ" },
  });
  fireEvent.change(screen.getByLabelText("Минут", { exact: true }), {
    target: { value: "35" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Алхам хадгалах" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Гурван жишээ биелсэн" }),
  );
  await waitFor(async () =>
    expect((await repo.load("guest"))?.data.tasks[0].extras.completedOn).toBe(
      day,
    ),
  );
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Үндсэн цэс" })).getByRole(
      "button",
      { name: "Календарь" },
    ),
  );
  expect(await screen.findByText("Биелсэн алхмууд")).toBeVisible();
  expect(
    within(screen.getByText("Биелсэн алхмууд").parentElement!).getByText(
      "Гурван жишээ",
    ),
  ).toBeVisible();
  expect(screen.getByText(/35м төлөвлөсөн/)).toBeVisible();
  await repo.close();
});

it("shares music preferences with the persistent player and restores the chosen category without autoplay", async () => {
  const audio = vi.fn();
  vi.stubGlobal("AudioContext", audio);
  localStorage.setItem(
    "togtmol:music:guest",
    JSON.stringify({ volume: 0.65, muted: false }),
  );
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Үндсэн цэс" })).getByRole(
      "button",
      { name: "Тохиргоо" },
    ),
  );
  fireEvent.change(screen.getByLabelText("Үндсэн хөгжмийн ангилал"), {
    target: { value: "night" },
  });
  fireEvent.click(screen.getByLabelText("Сүүлд тоглуулсан аяыг санах"));
  fireEvent.change(screen.getByLabelText("Дууны түвшин", { exact: true }), {
    target: { value: "0.25" },
  });
  expect(screen.getByLabelText(/Дууны түвшин · 25%/)).toHaveValue("0.25");
  expect(
    JSON.parse(localStorage.getItem("togtmol:music:guest")!),
  ).toMatchObject({
    volume: 0.25,
    defaultCategory: "night",
    rememberLast: false,
  });
  cleanup();
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
  expect(
    screen.getByText("Night study", { selector: ".music-title strong" }),
  ).toBeVisible();
  expect(audio).not.toHaveBeenCalled();
  expect(document.querySelector('script[src*="youtube"]')).toBeNull();
});

it("falls back to a labelled local reply when online AI has no configured account", async () => {
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Үндсэн цэс" })).getByRole(
      "button",
      { name: "Суралцах туслах" },
    ),
  );
  await screen.findByLabelText("Онлайн AI ашиглах");
  fireEvent.click(screen.getByLabelText("Онлайн AI ашиглах"));
  expect(screen.getByLabelText(/Сүүлийн 7 өдрийн 5 хүртэл/)).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Зөвшөөрч асаах" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Онлайн AI ашиглах")).toBeChecked(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Долоо хоногоо харъя" }));
  expect(await screen.findByText("Бондоок · Local")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByLabelText("Онлайн AI ашиглах")).not.toBeChecked(),
  );
  expect(
    within(screen.getByRole("log")).getByText(/Энэ долоо хоногт 0м/),
  ).toBeVisible();
});
