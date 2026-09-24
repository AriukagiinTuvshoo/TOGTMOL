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
import { Repository } from "@/lib/persistence/repository";
import { knowledgeFixture } from "./knowledge-fixtures";
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
async function boot() {
  const repo = new Repository();
  await repo.save("guest", knowledgeFixture(), 0);
  await repo.close();
  render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
}
function navigate(name: string) {
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Миний орон зай" }),
    ).getByRole("button", { name }),
  );
}
describe("knowledge flows", () => {
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
    await screen.findByText("Миний төлөвлөгөө");
    navigate("Миний мэдлэг");
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
