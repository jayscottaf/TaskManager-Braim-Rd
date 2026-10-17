import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const caches = { match: vi.fn().mockResolvedValue(new Response("Offline page", { headers: { "Content-Type": "text/html" } })) };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://app.example" }, addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; } },
    caches, fetch: vi.fn().mockRejectedValue(new Error("Offline")), URL, Response,
  });
  const response = (path: string, mode = "cors") => new Promise<Response>((resolve) => handlers.fetch({ request: { method: "GET", url: `https://app.example${path}`, mode }, respondWith: resolve }));
  return { response, caches };
}

describe("offline behavior", () => {
  it("returns an explicit JSON failure to API callers instead of cached homepage HTML", async () => {
    const { response, caches } = worker();
    const result = await response("/api/tasks");
    expect(result.status).toBe(503);
    expect(result.headers.get("Content-Type")).toBe("application/json");
    expect(await result.json()).toHaveProperty("error");
    expect(caches.match).not.toHaveBeenCalled();
  });
  it("shows the offline shell for navigation rather than stale task data", async () => {
    const { response, caches } = worker();
    expect(await (await response("/", "navigate")).text()).toBe("Offline page");
    expect(caches.match).toHaveBeenCalledWith("/offline.html");
  });
});
