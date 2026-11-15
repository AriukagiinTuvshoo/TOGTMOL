// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loginOrCreateSimpleProfile,
  namespaceForProfile,
  readActiveSimpleProfile,
  setActiveSimpleProfileId,
} from "@/lib/v9/simple-profile";
import { POST as geminiPOST } from "@/app/api/bondook/gemini/route";
import { AppShell } from "@/components/app-shell";
import { openView } from "./nav-helper";

vi.mock("@/lib/knowledge/pdf", () => ({
  extractPdfText: vi.fn(async () => ({
    text: "Термодинамикийн хуулиудын хичээлийн тэмдэглэл.",
    pages: 2,
    truncated: false,
  })),
}));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  window.localStorage.clear();
  setActiveSimpleProfileId(null);
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
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TOGTMOL v12 — Simple Profile, Custom Timer, Cute Emotions & Delight", () => {
  it("creates a Simple Profile with password hashing, rejects wrong password, and re-logs in", async () => {
    const created = await loginOrCreateSimpleProfile({
      name: "Түвшөө",
      password: "1234",
      avatar: "🦊",
      motto: "Өдөр бүр урагшаа!",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.isNew).toBe(true);
      expect(readActiveSimpleProfile()?.name).toBe("Түвшөө");
      expect(namespaceForProfile(created.profile.id)).not.toBe(
        namespaceForProfile("another-profile"),
      );
    }

    const wrong = await loginOrCreateSimpleProfile({
      name: "Түвшөө",
      password: "9999",
    });
    expect(wrong.ok).toBe(false);

    const relogin = await loginOrCreateSimpleProfile({
      name: "Түвшөө",
      password: "1234",
    });
    expect(relogin.ok).toBe(true);
    if (relogin.ok) {
      expect(relogin.isNew).toBe(false);
    }
  });

  it("lets students customize timer minutes, log daily emotions, pet Bondook, and sign in via Simple Profile", async () => {
    render(<AppShell />);

    // 1. Cozy onboarding is an inline, non-blocking invitation.
    expect(
      await screen.findByRole("button", { name: /Эхлүүлэх \(30 сек\)/i }),
    ).toBeInTheDocument();

    // 2. Custom Timer Duration Bar & Customizer
    const customTimeBtn = await screen.findByRole("button", {
      name: /Цаг өөрчлөх/i,
    });
    fireEvent.click(customTimeBtn);

    const focusInput = screen.getByLabelText("Фокус минут оруулах");
    fireEvent.change(focusInput, { target: { value: "42" } });

    await waitFor(() => {
      expect(screen.getByText(/42м фокус/)).toBeInTheDocument();
    });

    // 3. Cute Daily Emotion Check-in & Bondook Petting
    fireEvent.click(screen.getByRole("button", { name: /Урамтай/i }));
    expect(await screen.findByText(/Ямар гоё вэ!/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /👋 Илэх/i }));
    expect(screen.getByText(/💖 4/)).toBeInTheDocument();

    // 3. Simple Instant Profile Login via Header Modal
    fireEvent.click(screen.getByRole("button", { name: "Нэвтрэх ба бүртгэл" }));
    fireEvent.change(screen.getByPlaceholderText("Жишээ: Түвшөө"), {
      target: { value: "Болор" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "4321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Профайлаар шууд орох/i }),
    );
    // The profile sign-in hashes the password asynchronously; a loaded CI
    // runner needs more than the default 1s wait.
    expect(
      await screen.findByText(/Сайн уу, Болор!/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it("finishes the quick onboarding and prepares a selected study track", async () => {
    render(<AppShell />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Эхлүүлэх \(30 сек\)/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Код & Ур чадвар/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Миний өрөөг бэлдэх/i }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Эхлүүлэх \(30 сек\)/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("imports PDF lecture text into the Snap-to-Study bundle workflow", async () => {
    render(<AppShell />);
    openView("Миний мэдлэг");

    fireEvent.click(
      await screen.findByRole("button", { name: /Зургаас хичээл/i }),
    );

    const pdfInput = document.querySelector<HTMLInputElement>(
      'input[type="file"][accept="application/pdf,.pdf"]',
    );
    expect(pdfInput).not.toBeNull();
    const pdfFile = new File(["test pdf bytes"], "lecture.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(pdfInput!, { target: { files: [pdfFile] } });

    expect(
      await screen.findByText(/lecture\.pdf.*2 хуудас.*амжилттай уншлаа/i),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Термодинамикийн хуулиудын хичээлийн тэмдэглэл.",
      ),
    ).toBeInTheDocument();
  });

  it("limits shared server-key Gemini requests to 30 per IP while allowing personal keys", async () => {
    vi.stubEnv("GEMINI_API_KEY", "server-test-key");
    const mockFetch = vi.fn().mockImplementation(async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "Сайн уу!" }] } }],
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
    const ip = "203.0.113.121";
    const makeRequest = (personalKey?: string) =>
      new Request("http://localhost/api/bondook/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
          ...(personalKey ? { "x-gemini-api-key": personalKey } : {}),
        },
        body: JSON.stringify({ kind: "ping" }),
      });

    for (let i = 0; i < 30; i += 1) {
      expect((await geminiPOST(makeRequest())).status).toBe(200);
    }
    expect((await geminiPOST(makeRequest())).status).toBe(429);
    expect((await geminiPOST(makeRequest("personal-device-key"))).status).toBe(
      200,
    );
    expect(mockFetch).toHaveBeenCalledTimes(31);
  });
});
