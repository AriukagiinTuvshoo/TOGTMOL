import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
type EventHandler = (event: Record<string, unknown>) => void;
describe("service worker privacy and offline lifecycle", () => {
  function worker(
    options: { offline?: boolean; entries?: Record<string, string> } = {},
  ) {
    const entries = options.entries ?? {};
    const handlers = new Map<string, EventHandler>(),
      cached: string[] = [],
      requests: string[] = [],
      deleted: string[] = [],
      skipWaiting = { calls: 0 };
    const context = {
      URL,
      Response,
      Promise,
      Error,
      fetch: async (input: string | Request) => {
        requests.push(typeof input === "string" ? input : input.url);
        if (options.offline) throw new TypeError("offline");
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
        match: async (input: string | Request) => {
          const path =
            typeof input === "string" ? input : new URL(input.url).pathname;
          return path in entries ? new Response(entries[path]) : undefined;
        },
        keys: async () => ["togtmol-shell-old", "other-app"],
        delete: async (key: string) => {
          deleted.push(key);
        },
      },
      self: {
        location: { origin: "https://study.example" },
        clients: { claim: async () => {} },
        skipWaiting: () => {
          skipWaiting.calls += 1;
        },
        addEventListener: (name: string, handler: EventHandler) =>
          handlers.set(name, handler),
      },
    };
    runInNewContext(
      readFileSync("scripts/service-worker.template.js", "utf8"),
      context,
    );
    return { handlers, cached, requests, deleted, skipWaiting };
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
    // Legal pages are static routes, so they stay readable without a network.
    expect(cached).toContain("/privacy");
    expect(cached).toContain("/terms");
  });
  it("serves a precached legal page offline instead of the home screen", async () => {
    const { handlers } = worker({
      offline: true,
      entries: { "/privacy": "privacy page", "/": "home" },
    });
    const navigate = (path: string) => {
      let response: Promise<Response> | undefined;
      handlers.get("fetch")!({
        request: {
          method: "GET",
          mode: "navigate",
          url: `https://study.example${path}`,
          headers: new Headers(),
        },
        respondWith: (value: Promise<Response>) => {
          response = value;
        },
      });
      return response!;
    };
    expect(await (await navigate("/privacy")).text()).toBe("privacy page");
    // An uncached deep link still lands on the cached shell.
    expect(await (await navigate("/unknown")).text()).toBe("home");
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
  it("cleans only this app’s obsolete caches and waits for user approval", async () => {
    const { handlers, deleted, skipWaiting } = worker();
    let task: Promise<void> | undefined;
    handlers.get("activate")!({
      waitUntil: (p: Promise<void>) => {
        task = p;
      },
    });
    await task;
    expect(deleted).toEqual(["togtmol-shell-old"]);
    expect(skipWaiting.calls).toBe(0);
    handlers.get("message")!({ data: { type: "UNRELATED" } });
    expect(skipWaiting.calls).toBe(0);
    handlers.get("message")!({ data: { type: "SKIP_WAITING" } });
    expect(skipWaiting.calls).toBe(1);
  });
});
