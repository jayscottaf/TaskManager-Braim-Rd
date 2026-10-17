import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Task } from "../lib/types";

const services = vi.hoisted(() => ({ getTask: vi.fn(), analyzeTask: vi.fn() }));
vi.mock("../lib/notion", () => ({ getTask: services.getTask }));
vi.mock("../lib/ai", () => ({ analyzeTask: services.analyzeTask }));
vi.mock("../lib/auth", () => ({ checkAuth: () => null }));
import { POST } from "../app/api/ai/analyze-task/route";
import { clearCache } from "../lib/cache";
import { isTaskAnalysis } from "../lib/task-analysis";

const id = "11111111-1111-4111-8111-111111111111";
const task: Task = { id, task: "Check latch", status: "Not Started", priority: "Low", area: "Exterior", subLocation: null, type: ["General Repair"], frequency: "One-time", dueDate: null, dateCompleted: null, assignedTo: [], contractorVendor: null, costEstimate: 0, actualCost: null, notes: "Check the screws", tags: [], workMode: null, createdTime: "2026-01-01T00:00:00Z" };
const analysis = { diyGuidance: { recommendation: "DIY", reasoning: "Simple inspection", steps: ["Check screws"], materials: ["Screwdriver"] }, costSanityCheck: { estimateIsReasonable: true, expectedRange: { low: 0, high: 10 }, note: "Check local prices", neglectCost: null, neglectNote: "" }, contractorAdvice: { tradeType: "Handyman", questionsToAsk: [], redFlags: [] } };
const request = () => new NextRequest("http://localhost/api/ai/analyze-task", { method: "POST", body: JSON.stringify({ id }), headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.clearAllMocks(); clearCache(); services.getTask.mockResolvedValue(task); services.analyzeTask.mockResolvedValue(analysis); });

describe("optional task guidance", () => {
  it("reuses analysis after saving its generated notes and across simultaneous requests", async () => {
    const [first, second] = await Promise.all([POST(request()), POST(request())]);
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(services.analyzeTask).toHaveBeenCalledTimes(1);
    services.getTask.mockResolvedValue({ ...task, notes: `${task.notes}\n\nAI Analysis:\n${JSON.stringify(analysis)}` });
    expect((await POST(request())).status).toBe(200);
    expect(services.analyzeTask).toHaveBeenCalledTimes(1);
    services.getTask.mockResolvedValue({ ...task, notes: "The screw holes are stripped" });
    expect((await POST(request())).status).toBe(200);
    expect(services.analyzeTask).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed or negative estimates before rendering or caching them", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const invalid = { ...analysis, costSanityCheck: { ...analysis.costSanityCheck, expectedRange: { low: -10, high: 0 } } };
    expect(isTaskAnalysis(invalid)).toBe(false);
    services.analyzeTask.mockResolvedValue(invalid);
    expect((await POST(request())).status).toBe(502);
    services.analyzeTask.mockResolvedValue(analysis);
    expect((await POST(request())).status).toBe(200);
    expect(services.analyzeTask).toHaveBeenCalledTimes(2);
  });
  it("rejects an invalid task identity before accessing Notion", async () => {
    const response = await POST(new NextRequest("http://localhost/api/ai/analyze-task", { method: "POST", body: JSON.stringify({ id: "wrong" }) }));
    expect(response.status).toBe(400);
    expect(services.getTask).not.toHaveBeenCalled();
  });
});
