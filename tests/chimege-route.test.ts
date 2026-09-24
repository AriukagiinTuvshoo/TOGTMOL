import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: fake.getUser }, rpc: fake.rpc }),
}));

import { POST } from "@/app/api/chimege/transcribe/route";

function wav() {
  const buffer = new ArrayBuffer(44 + 16000 * 2);
  const view = new DataView(buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, buffer.byteLength - 44, true);
  return new Uint8Array(buffer);
}

const req = (body: BodyInit = wav(), token = true, contentType = "audio/wav") =>
  new Request("https://togtmol.test/api/chimege/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...(token ? { Authorization: "Bearer user-access-token" } : {}),
    },
    body,
  });

beforeEach(() => {
  vi.stubEnv("CHIMEGE_API_TOKEN", "chimege-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubEnv("BONDOOK_AI_ALLOWED_USER_IDS", "user-a");
  vi.stubEnv("CHIMEGE_ALLOWED_USER_IDS", "");
  fake.getUser.mockResolvedValue({
    data: { user: { id: "user-a" } },
    error: null,
  });
  fake.rpc.mockResolvedValue({ data: true, error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("Сайн байна уу?")),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("authenticated Chimege transcription route", () => {
  it("keeps the feature disabled until its server token and user allowlist exist", async () => {
    vi.stubEnv("CHIMEGE_API_TOKEN", "");
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(fake.getUser).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires a signed-in allowlisted user before consuming a request", async () => {
    expect((await POST(req(wav(), false))).status).toBe(401);
    fake.getUser.mockResolvedValue({
      data: { user: { id: "user-b" } },
      error: null,
    });
    expect((await POST(req())).status).toBe(403);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed content and WAV before spending quota", async () => {
    expect(
      (await POST(req(wav(), true, "application/octet-stream"))).status,
    ).toBe(415);
    expect((await POST(req(new Uint8Array([1, 2, 3])))).status).toBe(400);
    const oversized = new Uint8Array(1_920_045);
    expect((await POST(req(oversized))).status).toBe(413);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("limits paid calls, sends a WAV with the server-side token and returns only text", async () => {
    const response = await POST(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Сайн байна уу?" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fake.rpc).toHaveBeenCalledWith("consume_togi_request", {
      expected_user_id: "user-a",
    });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.chimege.com/v1.2/transcribe");
    expect(options?.headers).toEqual({
      Token: "chimege-secret",
      "Content-Type": "audio/wav",
    });
    expect(options?.body).toBeInstanceOf(ArrayBuffer);

    fake.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(req())).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not expose provider response details or secrets", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("private upstream error", { status: 500 }),
    );
    const response = await POST(req());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/private|secret/);
  });
});
