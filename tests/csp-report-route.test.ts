import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";

const report = (
  body: string,
  contentType = "application/csp-report",
  ip = "203.0.113.10",
) =>
  new Request("https://togtmol.test/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType, "x-forwarded-for": ip },
    body,
  });

const legacy = (ip?: string, contentType?: string) =>
  report(
    JSON.stringify({
      "csp-report": {
        "violated-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/steal?token=abc123",
        "document-uri": "https://togtmol.test/settings?secret=1",
        disposition: "report",
      },
    }),
    contentType,
    ip,
  );

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CSP report endpoint", () => {
  it("accepts a legacy report and logs only host-level fields", async () => {
    const response = await POST(legacy());
    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [, payload] = vi.mocked(console.warn).mock.calls[0];
    const logged = JSON.parse(String(payload));
    expect(logged).toEqual({
      directive: "script-src-elem",
      blocked: "evil.example",
      document: "togtmol.test",
      disposition: "report",
    });
    expect(JSON.stringify(logged)).not.toMatch(/token|secret|abc123/);
  });

  it("accepts the Reporting API batch format", async () => {
    const response = await POST(
      report(
        JSON.stringify([
          {
            type: "csp-violation",
            body: {
              effectiveDirective: "connect-src",
              blockedURL: "https://api.example.org/v1?key=leak",
              documentURL: "https://togtmol.test/",
              disposition: "report",
            },
          },
        ]),
        "application/reports+json",
        "203.0.113.11",
      ),
    );
    expect(response.status).toBe(204);
    const logged = JSON.parse(String(vi.mocked(console.warn).mock.calls[0][1]));
    expect(logged).toEqual({
      directive: "connect-src",
      blocked: "api.example.org",
      document: "togtmol.test",
      disposition: "report",
    });
  });

  it("rejects other content types", async () => {
    expect((await POST(legacy("203.0.113.12", "text/plain"))).status).toBe(415);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("rejects bodies above the size cap", async () => {
    const big = report(
      JSON.stringify({
        "csp-report": { "violated-directive": "x".repeat(20_000) },
      }),
      "application/csp-report",
      "203.0.113.13",
    );
    expect((await POST(big)).status).toBe(413);
  });

  it("drops malformed JSON without logging it", async () => {
    const response = await POST(
      report("not json", "application/csp-report", "203.0.113.14"),
    );
    expect(response.status).toBe(204);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("rate limits one client", async () => {
    for (let i = 0; i < 30; i += 1)
      expect(
        (await POST(legacy("203.0.113.15"))).status,
        `request ${i + 1}`,
      ).toBe(204);
    expect((await POST(legacy("203.0.113.15"))).status).toBe(429);
  });
});
