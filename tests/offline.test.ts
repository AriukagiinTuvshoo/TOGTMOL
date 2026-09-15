import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
type EventHandler = (event: Record<string, unknown>) => void;
describe("service worker privacy and offline lifecycle", () => {
  function worker() {
    const handlers = new Map<string, EventHandler>(),
      cached: string[] = [],
      requests: string[] = [],
      deleted: string[] = [];
    const context = {
      URL,
      Response,
      Promise,
      Error,
      fetch: async (input: string) => {
        requests.push(input);
        return new Response(
          JSON.stringify({
            assets: ["/_next/static/app.js", "/_next/static/app.css"],
          }),
          { status: 200 },
        );
      },
      caches: {
        open: async () => ({
          addAll: async (paths: string[]) => {
            cached.push(...paths);
          },
        }),
        keys: async () => ["togtmol-shell-old", "other-app"],
        delete: async (key: string) => {
          deleted.push(key);
        },
      },
      self: {
        location: { origin: "https://study.example" },
        clients: { claim: async () => {} },
        addEventListener: (name: string, handler: EventHandler) =>
          handlers.set(name, handler),
      },
    };
    runInNewContext(
      readFileSync("scripts/service-worker.template.js", "utf8"),
      context,
    );
    return { handlers, cached, requests, deleted };
  }
  it("pre-caches application JS and CSS on the first installation", async () => {
    const { handlers, cached } = worker();
    let task: Promise<void> | undefined;
    handlers.get("install")!({
      waitUntil: (p: Promise<void>) => {
        task = p;
      },
    });
    await task;
    expect(cached).toContain("/_next/static/app.js");
    expect(cached).toContain("/_next/static/app.css");
    expect(cached).toContain("/");
  });
  it("never intercepts Supabase, authorization headers, or OAuth callback URLs", () => {
    const { handlers } = worker();
    for (const input of [
      "https://project.supabase.co/rest/v1/subjects",
      "https://study.example/?code=secret",
      "https://study.example/?access_token=secret",
      "https://study.example/api/private",
    ]) {
      let intercepted = false;
      handlers.get("fetch")!({
        request: new Request(input),
        respondWith: () => {
          intercepted = true;
        },
      });
      expect(intercepted).toBe(false);
    }
    let intercepted = false;
    handlers.get("fetch")!({
      request: new Request("https://study.example/", {
        headers: { Authorization: "Bearer secret" },
      }),
      respondWith: () => {
        intercepted = true;
      },
    });
    expect(intercepted).toBe(false);
  });
  it("cleans only this app’s obsolete caches and waits for old tabs", async () => {
    const { handlers, deleted } = worker();
    let task: Promise<void> | undefined;
    handlers.get("activate")!({
      waitUntil: (p: Promise<void>) => {
        task = p;
      },
    });
    await task;
    expect(deleted).toEqual(["togtmol-shell-old"]);
    expect(
      readFileSync("scripts/service-worker.template.js", "utf8"),
    ).not.toMatch(/skipWaiting\(/);
  });
});
