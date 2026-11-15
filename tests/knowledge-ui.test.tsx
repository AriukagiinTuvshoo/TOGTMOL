// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { AppShell } from "@/components/app-shell";
import { openView } from "./nav-helper";
import { Repository } from "@/lib/persistence/repository";
import { knowledgeFixture, note as sampleNote } from "./knowledge-fixtures";
import { recordBase } from "@/lib/knowledge/actions";
beforeEach(() => {
  window.history.replaceState(null, "", "/");
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
async function boot(data = knowledgeFixture()) {
  const repo = new Repository();
  await repo.save("guest", data, 0);
  await repo.close();
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
}
function navigate(name: string) {
  openView(name);
}
describe("knowledge flows", () => {
  it("creates a topic, links a note to it and lists the note inside the topic", async () => {
    await boot();
    navigate("Миний мэдлэг");
    const add = await screen.findByRole("group", { name: "Мэдлэг нэмэх" });
    fireEvent.click(within(add).getByRole("button", { name: "Сэдэв" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Нэр" }), {
      target: { value: "Интеграл" },
    });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Тайлбар" }), {
      target: { value: "Талбай тооцоолох" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(within(add).getByRole("button", { name: "Тэмдэглэл" }));
    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Нэр" }), {
      target: { value: "Интегралын дүрэм" },
    });
    const topicSelect = within(dialog).getByRole("combobox", { name: "Сэдэв" });
    fireEvent.change(topicSelect, {
      target: {
        value: (
          within(topicSelect).getByRole("option", {
            name: "Интеграл",
          }) as HTMLOptionElement
        ).value,
      },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    const tabs = screen.getByRole("navigation", { name: "Мэдлэгийн төрөл" });
    fireEvent.click(within(tabs).getByRole("button", { name: "Сэдэв" }));
    fireEvent.click(await screen.findByRole("button", { name: "Интеграл" }));
    const detail = await screen.findByRole("dialog");
    expect(within(detail).getByText("Холбогдсон бичлэг")).toBeInTheDocument();
    expect(
      within(detail).getByRole("button", { name: /Интегралын дүрэм/ }),
    ).toBeInTheDocument();
  });

  async function generateFrom(
    sourceId: string,
    deck?: string,
    newTitle?: string,
  ) {
    navigate("Миний мэдлэг");
    const add = await screen.findByRole("group", { name: "Мэдлэг нэмэх" });
    fireEvent.click(within(add).getByRole("button", { name: "Карт үүсгэх" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Эх материал" }),
      { target: { value: sourceId } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Төхөөрөмж дээр загвар бэлдэх",
      }),
    );
    const deckSelect = await within(dialog).findByRole("combobox", {
      name: "Хадгалах багц",
    });
    if (deck) fireEvent.change(deckSelect, { target: { value: deck } });
    else if (newTitle)
      fireEvent.change(
        within(dialog).getByRole("textbox", { name: "Шинэ багцын нэр" }),
        { target: { value: newTitle } },
      );
    return dialog;
  }
  async function saveDeck(dialog: HTMLElement) {
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /Хянасан .* хадгалах/,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  }
  async function openDeck(title: string) {
    fireEvent.click(await screen.findByRole("button", { name: title }));
    return screen.getByRole("dialog");
  }

  it("links a newly generated deck to its source note", async () => {
    await boot();
    const dialog = await generateFrom("note-1", undefined, "Эхтэй багц");
    await saveDeck(dialog);
    const detail = await openDeck("Эхтэй багц");
    expect(within(detail).getByText(/Эх материал/)).toBeInTheDocument();
    expect(
      within(detail).getByRole("button", { name: /Тэгшитгэлийн санаа/ }),
    ).toBeInTheDocument();
  });

  it("adds a source to an existing deck that has none", async () => {
    await boot();
    const dialog = await generateFrom("note-1", "deck-1");
    await saveDeck(dialog);
    const detail = await openDeck("Алгебрын карт");
    expect(
      within(detail).getByRole("button", { name: /Тэгшитгэлийн санаа/ }),
    ).toBeInTheDocument();
  });

  it("keeps an existing source and says so before saving", async () => {
    const data = knowledgeFixture();
    data.knowledge = [
      ...data.knowledge,
      { ...sampleNote(), id: "note-2", title: "Хоёр дахь тэмдэглэл" },
    ].map((r) => (r.id === "deck-1" ? { ...r, sourceId: "note-2" } : r));
    await boot(data);
    const dialog = await generateFrom("note-1", "deck-1");
    expect(
      within(dialog).getByText(/эх материал өөрчлөгдөхгүй/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Хоёр дахь тэмдэглэл/)).toBeInTheDocument();
    await saveDeck(dialog);
    const detail = await openDeck("Алгебрын карт");
    expect(
      within(detail).getByRole("button", { name: /Хоёр дахь тэмдэглэл/ }),
    ).toBeInTheDocument();
  });

  it("hides a topic's own subtree from the parent picker", async () => {
    const data = knowledgeFixture();
    const make = (
      id: string,
      title: string,
      parentId: string | null = null,
    ) => ({
      ...recordBase(title, "math", [], Date.now()),
      id,
      kind: "topic" as const,
      parentId,
      description: "",
    });
    await boot({
      ...data,
      knowledge: [
        ...data.knowledge,
        make("ta", "A"),
        make("tb", "B", "ta"),
        make("tc", "C", "tb"),
        make("td", "D"),
      ],
    });
    navigate("Миний мэдлэг");
    fireEvent.click(await screen.findByRole("button", { name: "A" }));
    const detail = screen.getByRole("dialog");
    fireEvent.click(within(detail).getByRole("button", { name: "Засах" }));
    const dialogs = screen.getAllByRole("dialog");
    const editor = dialogs[dialogs.length - 1];
    const parent = within(editor).getByRole("combobox", { name: "Эх сэдэв" });
    const names = within(parent)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toContain("D");
    expect(names).not.toContain("A");
    expect(names).not.toContain("B");
    expect(names).not.toContain("C");
  });

  it("offers only the topics of the record's own subject", async () => {
    await boot();
    navigate("Миний мэдлэг");
    const add = await screen.findByRole("group", { name: "Мэдлэг нэмэх" });
    fireEvent.click(within(add).getByRole("button", { name: "Сэдэв" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Нэр" }), {
      target: { value: "Ерөнхий сэдэв" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(within(add).getByRole("button", { name: "Тэмдэглэл" }));
    dialog = screen.getByRole("dialog");
    const options = () =>
      within(dialog)
        .queryAllByRole("option")
        .map((option) => option.textContent ?? "");
    // Without a subject the topic is offered, since it belongs to no subject.
    expect(options()).toContain("Ерөнхий сэдэв");
    const subjectSelect = within(dialog)
      .getAllByRole("combobox")
      .find((select) =>
        within(select).queryByRole("option", { name: "Математик" }),
      )!;
    fireEvent.change(subjectSelect, { target: { value: "math" } });
    // Once the note belongs to Математик, the subject-less topic is gone.
    expect(options()).not.toContain("Ерөнхий сэдэв");
  });

  it("creates a searchable note, opens it with Ctrl K, soft-deletes and restores from trash", async () => {
    await boot();
    navigate("Миний мэдлэг");
    const add = await screen.findByRole("group", { name: "Мэдлэг нэмэх" });
    fireEvent.click(within(add).getByRole("button", { name: "Тэмдэглэл" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Нэр" }), {
      target: { value: "Хувийн шинэ санаа" },
    });
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Тэмдэглэл" }),
      {
        target: {
          value:
            "Инкапсуляци гэж өгөгдөл, үйлдлийг хамтад нь хадгалахыг хэлнэ.",
        },
      },
    );
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Шошго" }), {
      target: { value: "Python, OOP" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Хадгалах" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), {
      target: { value: "инкапсуляци" },
    });
    fireEvent.click(
      await within(screen.getByRole("dialog")).findByRole("button", {
        name: /Хувийн шинэ санаа/,
      }),
    );
    const detail = await screen.findByRole("dialog");
    expect(within(detail).getByText(/Инкапсуляци гэж/)).toBeVisible();
    fireEvent.click(
      within(detail).getByRole("button", { name: "Хогийн саванд шилжүүлэх" }),
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Мэдлэгийн төрөл" }),
      ).getByRole("button", { name: "Хогийн сав" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Сэргээх" }));
    await waitFor(async () => {
      const repo = new Repository();
      const saved = await repo.load("guest");
      expect(
        saved?.data.knowledge.find((r) => r.title === "Хувийн шинэ санаа")
          ?.deletedAt,
      ).toBeNull();
      await repo.close();
    });
  });
  it("reviews a card, persists its schedule and history, and survives a full remount", async () => {
    await boot();
    navigate("Миний мэдлэг");
    fireEvent.click(
      await screen.findByRole("button", { name: "Давтлага эхлүүлэх" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("x = 2")).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Хариулт харах" }),
    );
    expect(within(dialog).getByText("x = 2")).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "4 · Бодож саналаа" }),
    );
    await screen.findByText("Өнөөдөр мэдлэгээ бататгалаа.");
    const repo = new Repository(),
      saved = await repo.load("guest");
    expect(
      saved?.data.knowledge.filter((r) => r.kind === "review"),
    ).toHaveLength(1);
    expect(saved?.data.knowledge.find((r) => r.kind === "card")).toMatchObject({
      schedule: { repetitions: 1, interval: 1 },
    });
    await repo.close();
    cleanup();
    render(<AppShell />);
    await screen.findByRole("heading", { name: "Миний мэдлэг" });
    expect(window.location.hash).toBe("#/knowledge");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Давтлага эхлүүлэх" }),
      ).toBeDisabled(),
    );
  });
  it("takes all three quiz question types and explicitly converts mistakes into saved cards", async () => {
    await boot();
    navigate("Миний мэдлэг");
    fireEvent.click(await screen.findByRole("button", { name: "Сорих →" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("3"));
    fireEvent.click(within(dialog).getByLabelText("Худал"));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Хариулт" }), {
      target: { value: "DEF" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Хариултаа шалгах" }),
    );
    await screen.findByText("2 зөв · 1 дахин харах");
    dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Буруу хариултуудаар карт үүсгэх",
      }),
    );
    await screen.findByText("Давтах багц үүссэн");
    const repo = new Repository(),
      saved = await repo.load("guest");
    expect(
      saved?.data.knowledge.filter((r) => r.kind === "attempt"),
    ).toHaveLength(1);
    expect(saved?.data.knowledge.filter((r) => r.kind === "card")).toHaveLength(
      2,
    );
    await repo.close();
  });
  it("keeps Bondook chat history after navigation and turns off online consent from Privacy", async () => {
    await boot();
    navigate("Суралцах туслах");
    fireEvent.click(
      await screen.findByRole("button", { name: "Картаа давтъя" }),
    );
    await screen.findByText(/Мэдлэгийн санд 1 карт/);
    navigate("Миний өрөө");
    navigate("Суралцах туслах");
    expect(await screen.findByText(/Мэдлэгийн санд 1 карт/)).toBeVisible();
    fireEvent.click(screen.getByLabelText("Онлайн AI ашиглах"));
    fireEvent.click(screen.getByRole("button", { name: "Зөвшөөрч асаах" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Онлайн AI ашиглах")).toBeChecked(),
    );
    navigate("Нууцлал ба өгөгдөл");
    fireEvent.click(
      await screen.findByRole("button", { name: "AI боловсруулалтыг унтраах" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Онлайн Бондоокт зөвшөөрөл өгөөгүй."),
      ).toBeVisible(),
    );
    const repo = new Repository();
    await waitFor(async () => {
      expect((await repo.load("guest"))?.data.settings.extras.aiEnabled).toBe(
        false,
      );
    });
    await repo.close();
    navigate("Суралцах туслах");
    expect(await screen.findByLabelText("Онлайн AI ашиглах")).not.toBeChecked();
  });
});
