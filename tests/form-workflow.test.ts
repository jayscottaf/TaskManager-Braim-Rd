import { afterEach, describe, expect, it, vi } from "vitest";
import { draftUpdate, initialTaskDraft, mergePhotoSuggestions, recoverPendingCompletion, validateTaskDraft } from "../lib/task-form-data";
import { parseTaskNotes, serializeTaskNotes } from "../lib/task-notes";
import { RequestError, requestJson, safeReturnTo } from "../lib/client-request";
import type { PhotoClassification } from "../lib/ai";

const beforePhoto = "https://example.public.blob.vercel-storage.com/before.jpg";
const afterPhoto = "https://example.public.blob.vercel-storage.com/after.jpg";
const analysis = JSON.stringify({ summary: "Existing advice", cost: 300 });

const suggestion: PhotoClassification = {
  task: "Suggested repair", area: "Bathroom", type: ["Plumbing"], priority: "High", costEstimate: 125,
  description: "Possible leak",
};

afterEach(() => vi.unstubAllGlobals());

describe("task draft reliability", () => {
  it("clears optional fields explicitly and preserves a zero-dollar actual cost", () => {
    const draft = initialTaskDraft({ task: "Mulch", priority: "High", area: "Garden", costEstimate: 75 });
    Object.assign(draft, { priority: "", area: "", estimate: "", actual: "0", subLocation: "", contractor: "", workMode: "", frequency: "" });
    expect(draftUpdate(draft, parseTaskNotes(null))).toMatchObject({
      priority: null, area: null, costEstimate: null, actualCost: 0, subLocation: null,
      contractorVendor: null, workMode: null, frequency: null, dueDate: null, isDeadline: false, notes: null,
    });
  });

  it("completion includes the entire current draft and all existing attachments", () => {
    const raw = `Keep this note.\n\nPhotos:\n${beforePhoto}\n\nAfter photo: ${afterPhoto}\n\nAI Analysis:\n${analysis}`;
    const draft = initialTaskDraft({ task: "Paint porch", notes: raw, costEstimate: 300 });
    draft.name = "Paint front porch";
    draft.actual = "87.50";
    draft.notes = "Used the saved paint color.";
    const newAfter = "https://example.public.blob.vercel-storage.com/new-after.jpg";
    const update = draftUpdate(draft, parseTaskNotes(raw), "Completed", newAfter);
    expect(update).toMatchObject({ task: "Paint front porch", status: "Completed", actualCost: 87.5, costEstimate: 300 });
    expect(parseTaskNotes(update.notes)).toEqual({
      text: draft.notes, photos: [beforePhoto], afterPhotos: [afterPhoto, newAfter], analysis,
    });
  });

  it("editing notes repeatedly keeps one copy of photos, analysis and completion history", () => {
    const raw = `Notes\n\nPhotos:\n${beforePhoto}\n\nAfter photo: ${afterPhoto}\n\nAI Analysis:\n${analysis}`;
    const first = serializeTaskNotes(parseTaskNotes(raw));
    expect(serializeTaskNotes(parseTaskNotes(first))).toBe(first);
    expect(parseTaskNotes(first).text).toBe("Notes");
    expect(parseTaskNotes(first).photos).toEqual([beforePhoto]);
    expect(parseTaskNotes(first).afterPhotos).toEqual([afterPhoto]);
  });

  it("retains a typed title, notes, date and explicit cleared metadata when a photo finishes", () => {
    const draft = initialTaskDraft({ task: "My own title", dueDate: { start: "2026-10-20" } });
    draft.notes = "The roof is already fixed.";
    const merged = mergePhotoSuggestions(draft, suggestion, new Set(["name", "notes", "date", "area"]));
    expect(merged.name).toBe("My own title");
    expect(merged.notes).toBe(draft.notes);
    expect(merged.date).toBe(draft.date);
    expect(merged.area).toBe("");
    expect(merged.types).toEqual(["Plumbing"]);
    expect(merged.estimate).toBe("125");
  });

  it("creates a flexible target by default and cannot leave a deadline without a date", () => {
    const draft = initialTaskDraft({ task: "Mulch", dueDate: { start: "2026-04-15" } });
    expect(draftUpdate(draft, parseTaskNotes(null)).isDeadline).toBe(false);
    draft.isDeadline = true;
    expect(draftUpdate(draft, parseTaskNotes(null)).isDeadline).toBe(true);
    draft.date = "";
    expect(draftUpdate(draft, parseTaskNotes(null))).toMatchObject({ dueDate: null, isDeadline: false });
  });

  it("ignores malformed AI fields without corrupting the draft", () => {
    const draft = initialTaskDraft();
    const malformed = { task: null, area: "Other", priority: "Critical", type: ["Plumbing", "Unknown"], costEstimate: -5 } as unknown as PhotoClassification;
    expect(mergePhotoSuggestions(draft, malformed, new Set())).toEqual({ ...draft, types: ["Plumbing"] });
  });

  it("rejects invalid money and reversed date ranges before saving", () => {
    const draft = initialTaskDraft({ task: "Repair" });
    draft.actual = "invalid";
    expect(validateTaskDraft(draft)).toContain("cost");
    draft.actual = "0";
    draft.date = "2026-10-20";
    draft.endDate = "2026-10-19";
    expect(validateTaskDraft(draft)).toContain("end date");
  });

  it("keeps unknown historical completion dates blank until explicitly supplied", () => {
    const draft = initialTaskDraft({ task: "Past repair", status: "Completed", dateCompleted: null });
    expect(draftUpdate(draft, parseTaskNotes(null)).dateCompleted).toBeNull();
    draft.completedDate = "2026-08-09";
    expect(draftUpdate(draft, parseTaskNotes(null)).dateCompleted).toEqual({ start: "2026-08-09" });
    draft.completedDate = "";
    expect(draftUpdate(draft, parseTaskNotes(null)).dateCompleted).toBeNull();
  });

  it("keeps the completed status and saved date when only next-occurrence scheduling failed", () => {
    const draft = initialTaskDraft({ id: "mulch", task: "Mulch", status: "Not Started", notes: `My note\n\nPhotos:\n${beforePhoto}`, costEstimate: 75 });
    draft.actual = "62";
    const response = { saved: true, recurrencePending: true, task: { id: "mulch", status: "Completed", dateCompleted: { start: "2026-10-16" } } };
    const recovered = recoverPendingCompletion(draft, response, "mulch")!;
    expect(recovered).toEqual({ ...draft, status: "Completed", completedDate: "2026-10-16" });
    const retry = draftUpdate(recovered, parseTaskNotes(null));
    expect(retry).toMatchObject({ status: "Completed", dateCompleted: { start: "2026-10-16" }, actualCost: 62 });
    expect(parseTaskNotes(retry.notes).photos).toEqual([beforePhoto]);
    expect(recoverPendingCompletion(draft, response, "another-task")).toBeNull();
    expect(recoverPendingCompletion(draft, { ...response, saved: false }, "mulch")).toBeNull();
  });
});

describe("mutation and navigation boundaries", () => {
  it("surfaces HTTP failures including a completion saved with its next occurrence still pending", async () => {
    const body = { error: "Task saved, but the next occurrence could not be scheduled. Retry.", saved: true, recurrencePending: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 502 })));
    const failure = await requestJson("/api/tasks/one", { method: "PATCH" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RequestError);
    expect(failure).toMatchObject({ message: body.error, status: 502, body });
  });

  it("handles non-JSON failures without reporting success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(requestJson("/api/tasks", { method: "POST" })).rejects.toThrow("503");
  });

  it("accepts only safe internal return destinations with original filters", () => {
    expect(safeReturnTo("/?search=porch&range=all")).toBe("/?search=porch&range=all");
    expect(safeReturnTo("/calendar?date=2026-10-20")).toBe("/calendar?date=2026-10-20");
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/api/tasks", "/add", "/task/one"]) {
      expect(safeReturnTo(value)).toBeNull();
    }
  });
});
