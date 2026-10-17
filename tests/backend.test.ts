import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({
  databases: { query: vi.fn(), retrieve: vi.fn(), update: vi.fn() },
  pages: { retrieve: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@notionhq/client", () => ({ Client: class { databases = remote.databases; pages = remote.pages; } }));

import { clearCache, getCached, getOrLoadCached, setCache } from "../lib/cache";
import { createTask, findWishlistTask, getTask, getTasks, updateTask } from "../lib/notion";
import { EarlyRecurrenceCompletionError, RecurrencePendingError, updateTaskWithRecurrence } from "../app/api/tasks/mutations";
import { validateTaskInput } from "../app/api/tasks/validation";
import { PATCH } from "../app/api/tasks/[id]/route";
import { NextRequest } from "next/server";
import type { Task, UpdateTaskInput } from "../lib/types";

vi.mock("../lib/auth", () => ({ checkAuth: () => null }));

type Property = Record<string, unknown>;
type Page = { id: string; object: "page"; archived: boolean; created_time: string; properties: Record<string, Property> };
let pages: Map<string, Page>;
let lostCreateResponse = false;

function readableProperty(value: Property): Property {
  const type = Object.keys(value)[0];
  if (type === "title" || type === "rich_text") {
    const segments = value[type] as { text: { content: string } }[];
    return { type, [type]: segments.map((segment) => ({ plain_text: segment.text.content })) };
  }
  return { type, ...value };
}

function fixture(id = "parent", overrides: Record<string, Property> = {}): Page {
  const properties = {
    Task: { title: [{ text: { content: "Mulch" } }] }, Status: { status: { name: "Not Started" } },
    Priority: { select: { name: "Low" } }, Area: { select: { name: "Garden" } }, "Sub-location": { rich_text: [{ text: { content: "Front bed" } }] },
    Frequency: { select: { name: "Monthly" } }, "Due Date": { date: { start: "2024-01-31", end: "2024-02-02" } },
    "Cost Estimate": { number: 0 }, "Actual Cost": { number: null }, "Contractor/Vendor": { rich_text: [{ text: { content: "Local store" } }] },
    Notes: { rich_text: [{ text: { content: "Keep shrubs clear" } }] }, Tags: { multi_select: [{ name: "Spring" }] }, "Work Mode": { select: { name: "DIY" } },
    "Firm Deadline": { checkbox: true }, ...overrides,
  };
  return { id, object: "page", archived: false, created_time: "2024-01-01T00:00:00Z", properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, readableProperty(value)])) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2024-02-01T17:00:00Z"));
  vi.clearAllMocks();
  clearCache();
  pages = new Map([["parent", fixture()]]);
  lostCreateResponse = false;
  remote.databases.retrieve.mockResolvedValue({ properties: {} });
  remote.databases.update.mockResolvedValue({});
  remote.databases.query.mockImplementation(async (query: { filter?: { property: string; rich_text?: { equals?: string; contains?: string } } }) => {
    const results = [...pages.values()].filter((page) => !page.archived && (!query.filter?.rich_text || (page.properties[query.filter.property]?.rich_text as { plain_text: string }[] | undefined)?.some((value) => query.filter?.rich_text?.equals !== undefined ? value.plain_text === query.filter.rich_text.equals : value.plain_text.includes(query.filter?.rich_text?.contains ?? ""))));
    return { results, has_more: false, next_cursor: null };
  });
  remote.pages.retrieve.mockImplementation(async ({ page_id }: { page_id: string }) => {
    if (!pages.has(page_id)) throw new Error("Missing page");
    return structuredClone(pages.get(page_id));
  });
  remote.pages.create.mockImplementation(async ({ properties }: { properties: Record<string, Property> }) => {
    const page = fixture(`next-${pages.size}`, properties);
    pages.set(page.id, page);
    if (lostCreateResponse) { lostCreateResponse = false; throw new Error("Connection lost after write"); }
    return structuredClone(page);
  });
  remote.pages.update.mockImplementation(async ({ page_id, properties = {}, archived }: { page_id: string; properties?: Record<string, Property>; archived?: boolean }) => {
    const page = pages.get(page_id)!;
    for (const [name, value] of Object.entries(properties)) page.properties[name] = readableProperty(value);
    if (archived !== undefined) page.archived = archived;
    return structuredClone(page);
  });
});

afterEach(() => vi.useRealTimers());

describe("task persistence and cache", () => {
  it("retrieves all pages and shares concurrent list reads", async () => {
    remote.databases.query.mockResolvedValueOnce({ results: [fixture("a")], has_more: true, next_cursor: "cursor-2" })
      .mockResolvedValueOnce({ results: [fixture("b")], has_more: false, next_cursor: null });
    const [first, second] = await Promise.all([getTasks(), getTasks()]);
    expect(first.map((task) => task.id)).toEqual(["a", "b"]);
    expect(second).toEqual(first);
    expect(remote.databases.query).toHaveBeenCalledTimes(2);
    expect(remote.databases.query.mock.calls[1][0]).toMatchObject({ start_cursor: "cursor-2" });
    await getTasks();
    expect(remote.databases.query).toHaveBeenCalledTimes(3);
  });

  it("clears nullable fields, preserves zero, and persists deadline changes", async () => {
    const task = await updateTask("parent", { priority: null, area: null, subLocation: null, frequency: null, dueDate: null, contractorVendor: null, costEstimate: 0, actualCost: 0, notes: null, tags: [], type: [], workMode: null });
    expect(task).toMatchObject({ priority: null, area: null, subLocation: null, frequency: null, dueDate: null, contractorVendor: null, costEstimate: 0, actualCost: 0, notes: null, tags: [], type: [], workMode: null, isDeadline: false });
    expect(remote.databases.update).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ "Firm Deadline": { checkbox: {} } }) }));
  });

  it("invalidates affected tasks and aggregate recommendations without erasing unrelated caches", async () => {
    await getTasks();
    setCache("ai-analyze:other:hash", { analysis: true }, 10000);
    setCache("schema:other", true, 10000);
    setCache("start-my-day:v3:today:30", { oldPlan: true }, 10000);
    setCache("ai-prioritize", ["old"], 10000);
    await updateTask("parent", { notes: "Updated" });
    expect(getCached("tasks:|||" )).toBeNull();
    expect(getCached("start-my-day:v3:today:30")).toBeNull();
    expect(getCached("ai-prioritize")).toBeNull();
    expect(getCached("ai-analyze:other:hash")).toEqual({ analysis: true });
    expect(getCached("schema:other")).toBe(true);
  });

  it("does not restore a stale in-flight read after cache invalidation", async () => {
    let resolve!: (value: string) => void;
    const pending = getOrLoadCached("pending", 10000, () => new Promise<string>((done) => { resolve = done; }));
    await Promise.resolve();
    clearCache("pending");
    resolve("old");
    expect(await pending).toBe("old");
    expect(getCached("pending")).toBeNull();
    expect(await getOrLoadCached("pending", 10000, async () => "new")).toBe("new");
  });

  it("stores wishlist promotion identity outside user notes and retrieves it freshly", async () => {
    const created = await createTask({ task: "Driveway project", notes: "Keep the paving sample" }, undefined, { wishlistSourceId: "idea-123" });
    expect(created.notes).toBe("Keep the paving sample");
    expect(await findWishlistTask("idea-123")).toMatchObject({ id: created.id, notes: "Keep the paving sample" });
    expect(remote.pages.create.mock.calls[0][0].properties["Wishlist Source"]).toEqual({ rich_text: [{ text: { content: "idea-123" } }] });
    expect(remote.databases.query).toHaveBeenCalledTimes(1);
    expect(remote.databases.query.mock.calls[0][0]).toMatchObject({ filter: { property: "Wishlist Source", rich_text: { equals: "idea-123" } } });
  });

  it("can recover a legacy wishlist notes marker without a full task-list scan", async () => {
    pages.set("legacy", fixture("legacy", { Notes: { rich_text: [{ text: { content: "Owner notes\n[wishlist-source:old-idea]" } }] } }));
    expect(await findWishlistTask("old-idea")).toMatchObject({ id: "legacy" });
    expect(remote.databases.query).toHaveBeenCalledTimes(2);
    expect(await findWishlistTask("missing-idea")).toBeNull();
  });

  it("sees writes from another server instance without local cache invalidation", async () => {
    await getTasks();
    // Change the provider directly: the write occurred outside this process.
    pages.get("parent")!.properties.Status = readableProperty({ status: { name: "Completed" } });
    pages.set("new", fixture("new"));
    const refreshed = await getTasks();
    expect(refreshed).toHaveLength(2);
    expect(refreshed.find((task) => task.id === "parent")?.status).toBe("Completed");
    expect(await getTasks({ bypassCache: true })).toHaveLength(2);
  });
});

describe("completion recovery", () => {
  it("saves current edits before creating one successor and preserves recurrence context", async () => {
    const result = await updateTaskWithRecurrence("parent", { status: "Completed", task: "Fresh mulch", notes: "Updated instructions", actualCost: 42, dateCompleted: { start: "2024-02-01" } });
    expect(result).toMatchObject({ task: "Fresh mulch", status: "Completed", actualCost: 42, dateCompleted: { start: "2024-02-01" }, nextOccurrencePending: false });
    expect(result.nextOccurrence).toMatchObject({ task: "Fresh mulch", status: "Not Started", actualCost: null, dueDate: { start: "2024-02-29", end: "2024-03-02" }, notes: "Updated instructions", tags: ["Spring"], workMode: "DIY", isDeadline: true, costEstimate: 0, recurrenceAnchor: { start: "2024-01-31", end: "2024-02-02" }, recurrenceSource: "parent" });
    expect(remote.pages.update.mock.invocationCallOrder[0]).toBeLessThan(remote.pages.create.mock.invocationCallOrder[0]);
    await updateTaskWithRecurrence("parent", { status: "Completed", notes: "Edit after completion" });
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
  });

  it("preserves month-end anchors when a full form resubmits an unchanged due date", async () => {
    const completed = await updateTaskWithRecurrence("parent", { status: "Completed" });
    const successor = completed.nextOccurrence!;
    const result = await updateTaskWithRecurrence(successor.id, { status: "Completed", dueDate: successor.dueDate }, { confirmEarlyCompletion: true });
    expect(result.nextOccurrence?.dueDate).toEqual({ start: "2024-03-31", end: "2024-04-02" });
  });

  it("creates no successor when saving the original fails", async () => {
    remote.pages.update.mockRejectedValueOnce(new Error("Notion unavailable"));
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toThrow("Notion unavailable");
    expect(remote.pages.create).not.toHaveBeenCalled();
  });

  it("recovers a lost successor-create response from persisted identity", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    lostCreateResponse = true;
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toBeInstanceOf(RecurrencePendingError);
    expect(await getTask("parent", { bypassCache: true })).toMatchObject({ status: "Completed", nextOccurrencePending: true });
    const retried = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(retried.nextOccurrence?.dueDate?.start).toBe("2024-02-29");
    expect(retried.nextOccurrencePending).toBe(false);
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
    expect(pages.size).toBe(2);
  });

  it("serializes simultaneous completion attempts and resets completion metadata on reopening", async () => {
    await Promise.all([updateTaskWithRecurrence("parent", { status: "Completed" }), updateTaskWithRecurrence("parent", { status: "Completed" })]);
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
    expect(await updateTaskWithRecurrence("parent", { status: "In Progress" })).toMatchObject({ status: "In Progress", dateCompleted: null, nextOccurrencePending: false });
  });

  it("never creates a successor when editing a previously completed legacy task", async () => {
    pages.set("parent", fixture("parent", { Status: { status: { name: "Completed" } } }));
    await updateTaskWithRecurrence("parent", { status: "Completed", notes: "Historical correction" });
    expect(remote.pages.create).not.toHaveBeenCalled();
  });

  it("keeps persisted successor identity when reopening after an interrupted completion", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    lostCreateResponse = true;
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toBeInstanceOf(RecurrencePendingError);
    const reopened = await updateTaskWithRecurrence("parent", { status: "In Progress" });
    expect(reopened).toMatchObject({ dateCompleted: null, nextOccurrencePending: false });
    const recompleted = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(recompleted.nextOccurrence?.id).toBe("next-1");
    expect(recompleted.nextOccurrencePending).toBe(false);
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
    expect(pages.size).toBe(2);
  });

  it("can reopen before a failed successor write and schedule once on the next completion", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    remote.pages.create.mockRejectedValueOnce(new Error("Unavailable before write"));
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toBeInstanceOf(RecurrencePendingError);
    await updateTaskWithRecurrence("parent", { status: "Not Started" });
    const result = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(result.nextOccurrence?.dueDate?.start).toBe("2024-02-29");
    expect(pages.size).toBe(2);
  });

  it("creates the successor using an edited completion date range and frequency", async () => {
    const result = await updateTaskWithRecurrence("parent", { status: "Completed", frequency: "Annually", dueDate: { start: "2024-02-29", end: "2024-03-03" } }, { confirmEarlyCompletion: true });
    expect(result.nextOccurrence?.dueDate).toEqual({ start: "2025-02-28", end: "2025-03-03" });
  });

  it("skips missed annual periods when old maintenance is completed today", async () => {
    vi.setSystemTime(new Date("2026-10-17T17:00:00Z"));
    pages.set("parent", fixture("parent", { Frequency: { select: { name: "Annually" } }, "Due Date": { date: { start: "2024-04-15" } } }));
    const result = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(result.dateCompleted?.start).toBe("2026-10-17");
    expect(result.nextOccurrence).toMatchObject({ dueDate: { start: "2027-04-15" }, recurrenceAnchor: { start: "2024-04-15" } });
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
  });

  it("skips missed monthly periods while preserving the original month-end anchor", async () => {
    vi.setSystemTime(new Date("2024-05-15T17:00:00Z"));
    const result = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(result.nextOccurrence).toMatchObject({ dueDate: { start: "2024-05-31", end: "2024-06-02" }, recurrenceAnchor: { start: "2024-01-31", end: "2024-02-02" } });
  });

  it("uses a deliberate historical completion day rather than today's date", async () => {
    vi.setSystemTime(new Date("2026-10-17T17:00:00Z"));
    const result = await updateTaskWithRecurrence("parent", { status: "Completed", dateCompleted: { start: "2024-02-01" } });
    expect(result.nextOccurrence?.dueDate).toEqual({ start: "2024-02-29", end: "2024-03-02" });
  });

  it("keeps the saved completion day when scheduling is retried much later", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.setSystemTime(new Date("2026-10-17T17:00:00Z"));
    pages.set("parent", fixture("parent", { Frequency: { select: { name: "Annually" } }, "Due Date": { date: { start: "2024-04-15" } } }));
    remote.pages.create.mockRejectedValueOnce(new Error("Unavailable before write"));
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toBeInstanceOf(RecurrencePendingError);
    vi.setSystemTime(new Date("2027-10-17T17:00:00Z"));
    const result = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(result.dateCompleted?.start).toBe("2026-10-17");
    expect(result.nextOccurrence?.dueDate?.start).toBe("2027-04-15");
  });
});

describe("future recurring completion safety", () => {
  const future = { Frequency: { select: { name: "Annually" } }, "Due Date": { date: { start: "2090-04-15" } } };

  it("rejects a future recurring completion without writing, including unmarked legacy copies", async () => {
    pages.set("parent", fixture("parent", future));
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" })).rejects.toBeInstanceOf(EarlyRecurrenceCompletionError);
    expect(remote.pages.update).not.toHaveBeenCalled();
    expect(remote.pages.create).not.toHaveBeenCalled();
  });

  it("returns an actionable 409 and accepts one explicit early completion confirmation", async () => {
    pages.set("parent", fixture("parent", future));
    const request = (body: object) => new NextRequest("http://localhost/api/tasks/parent", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const blocked = await PATCH(request({ status: "Completed" }), { params: Promise.resolve({ id: "parent" }) });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: "EARLY_RECURRENCE_COMPLETION", plannedFor: "2090-04-15", task: { id: "parent", status: "Not Started" } });
    expect(remote.pages.update).not.toHaveBeenCalled();
    const confirmed = await PATCH(request({ status: "Completed", confirmEarlyCompletion: true }), { params: Promise.resolve({ id: "parent" }) });
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ status: "Completed", nextOccurrence: { dueDate: { start: "2091-04-15" }, recurrenceSource: "parent" } });
    for (const [args] of remote.pages.update.mock.calls) expect(args.properties).not.toHaveProperty("confirmEarlyCompletion");
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
  });

  it("checks submitted date and frequency edits, while allowing future one-time work", async () => {
    await expect(updateTaskWithRecurrence("parent", { status: "Completed", frequency: "Annually", dueDate: { start: "2090-04-15" } })).rejects.toBeInstanceOf(EarlyRecurrenceCompletionError);
    expect(remote.pages.update).not.toHaveBeenCalled();
    pages.set("parent", fixture("parent", { ...future, Frequency: { select: { name: "One-time" } } }));
    expect(await updateTaskWithRecurrence("parent", { status: "Completed" })).toMatchObject({ status: "Completed" });
    expect(remote.pages.create).not.toHaveBeenCalled();
  });

  it("allows deliberate rescheduling to a past date before completing", async () => {
    pages.set("parent", fixture("parent", future));
    const result = await updateTaskWithRecurrence("parent", { status: "Completed", dueDate: { start: "2024-01-15" } });
    expect(result.nextOccurrence?.dueDate?.start).toBe("2025-01-15");
  });

  it("does not interrupt confirmed completion recovery or editing completed future history", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    pages.set("parent", fixture("parent", future));
    lostCreateResponse = true;
    await expect(updateTaskWithRecurrence("parent", { status: "Completed" }, { confirmEarlyCompletion: true })).rejects.toBeInstanceOf(RecurrencePendingError);
    const retried = await updateTaskWithRecurrence("parent", { status: "Completed" });
    expect(retried.nextOccurrence?.dueDate?.start).toBe("2091-04-15");
    await updateTaskWithRecurrence("parent", { status: "Completed", notes: "Corrected history" });
    expect(remote.pages.create).toHaveBeenCalledTimes(1);
  });
});

describe("task input validation", () => {
  it("rejects blank names, negative amounts, invalid dates/ranges and unknown enum values", () => {
    for (const body of [{ task: "   " }, { task: "Mulch", costEstimate: -1 }, { task: "Mulch", dueDate: { start: "2024-02-30" } }, { task: "Mulch", dueDate: { start: "2024-03-02", end: "2024-03-01" } }, { task: "Mulch", status: "Done" }]) {
      expect(validateTaskInput(body, "create").error).toBeTruthy();
    }
  });
  it("keeps nullable clears and zero values but excludes internal metadata", () => {
    expect(validateTaskInput({ costEstimate: 0, area: null, isDeadline: true, nextOccurrencePending: true, recurrenceAnchor: { start: "2020-01-01" } }, "update").input).toEqual({ costEstimate: 0, area: null, isDeadline: true });
  });
  it("does not allow a cleared date to remain a firm deadline", () => {
    expect(validateTaskInput({ dueDate: null, isDeadline: true }, "update").input).toEqual({ dueDate: null, isDeadline: false });
  });
  it("keeps early-completion confirmation out of persisted task fields and requires a boolean", () => {
    expect(validateTaskInput({ status: "Completed", confirmEarlyCompletion: true }, "update")).toEqual({ input: { status: "Completed" }, confirmEarlyCompletion: true });
    expect(validateTaskInput({ status: "Completed", confirmEarlyCompletion: "true" }, "update").error).toBeTruthy();
    expect(validateTaskInput({ confirmEarlyCompletion: true }, "update").error).toBe("No task changes supplied");
  });
});

const historicalCases: { name: string; date: Task["dateCompleted"]; changes: UpdateTaskInput; expected: Task["dateCompleted"] }[] = [
  { name: "undated full-form save", date: null, changes: { status: "Completed", task: "Historical mulch", notes: "Corrected note" }, expected: null },
  { name: "explicitly cleared completion date", date: { start: "2024-02-01" }, changes: { status: "Completed", dateCompleted: null }, expected: null },
  { name: "original completion date", date: { start: "2024-02-01" }, changes: { status: "Completed", notes: "Corrected note" }, expected: { start: "2024-02-01" } },
];

describe.each(["mutation", "PATCH route"] as const)("completed history through %s", (entryPoint) => {
  it.each(historicalCases)("preserves $name", async ({ date, changes, expected }) => {
    pages.set("parent", fixture("parent", { Status: { status: { name: "Completed" } }, "Date Completed": { date } }));
    let saved: Task;
    if (entryPoint === "mutation") {
      saved = await updateTaskWithRecurrence("parent", changes);
    } else {
      const request = new NextRequest("http://localhost/api/tasks/parent", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      const response = await PATCH(request, { params: Promise.resolve({ id: "parent" }) });
      expect(response.status).toBe(200);
      saved = await response.json();
    }
    expect(saved.dateCompleted).toEqual(expected);
    expect((await getTask("parent", { bypassCache: true })).dateCompleted).toEqual(expected);
    expect(remote.pages.create).not.toHaveBeenCalled();
  });
});
