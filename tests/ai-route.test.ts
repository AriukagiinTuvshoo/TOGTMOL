import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: fake.getUser }, rpc: fake.rpc }),
}));
import { POST } from "@/app/api/togi/route";
const payload = { message: "Долоо хоног", context: { weeklyMinutes: 25 } };
const req = (value: unknown = payload, token = true) =>
  new Request("http://localhost/api/togi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer test-token" } : {}),
    },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-secret");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubEnv("TOGI_AI_ALLOWED_USER_IDS", "user-a");
  fake.getUser.mockResolvedValue({
    data: { user: { id: "user-a" } },
    error: null,
  });
  fake.rpc.mockResolvedValue({ data: true, error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "25 минут." }],
          },
        ],
      }),
    ),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("optional server-only AI", () => {
  it("stays local when unconfigured and never calls a paid provider", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(req());
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires authentication and the server allowlist before consuming quota", async () => {
    expect((await POST(req(payload, false))).status).toBe(401);
    fake.getUser.mockResolvedValue({
      data: { user: { id: "user-b" } },
      error: null,
    });
    expect((await POST(req())).status).toBe(403);
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds request size and refuses exhausted quota", async () => {
    expect(
      (await POST(req({ message: "a", context: { value: "x".repeat(25000) } })))
        .status,
    ).toBe(413);
    fake.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(req())).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses server credentials, disables response storage and only returns assistant text", async () => {
    const response = await POST(req());
    expect(await response.json()).toEqual({ text: "25 минут.", kind: "ai" });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(options!.body as string)).toMatchObject({
      model: "test-model",
      store: false,
      max_output_tokens: 800,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fake.rpc).toHaveBeenCalledWith("consume_togi_request", {
      expected_user_id: "user-a",
    });
  });
  it("never exposes provider failures or secrets to the browser", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("secret upstream details", { status: 500 }),
    );
    const response = await POST(req());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/secret|test-only/);
  });
});
