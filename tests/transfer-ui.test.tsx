// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { AppShell } from "@/components/app-shell";
import { openView } from "./nav-helper";

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

describe("Anki import settings", () => {
  it("previews pasted notes and imports them into a new deck", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    openView("Тохиргоо");

    const paste = await screen.findByLabelText("Эсвэл текстээ энд буулгана уу");
    fireEvent.change(paste, {
      target: {
        value:
          "#separator:tab\n#html:true\nATP гэж юу вэ?\tЭнергийн мөнгөн тэмдэгт<br>эсвэл валюта\tbio\nМитохондри\tATP үйлдвэрлэгч\tbio",
      },
    });
    expect(await screen.findByText(/2 карт илэрлээ/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Шинэ багцын нэр"), {
      target: { value: "Биологи" },
    });
    fireEvent.click(screen.getByRole("button", { name: "2 картыг импортлох" }));
    await waitFor(() =>
      expect(screen.getByText(/2 карт нэмэгдлээ/)).toBeInTheDocument(),
    );
  });

  it("explains why .apkg cannot be read directly", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    openView("Тохиргоо");
    const input = (
      await screen.findByText("CSV / TSV / TXT файл сонгох")
    ).parentElement!.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["zip"], "deck.apkg");
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/\.apkg/);
  });
});
