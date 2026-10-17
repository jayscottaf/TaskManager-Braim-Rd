// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskForm } from "../components/task-form";
import { TaskCard } from "../components/task-card";
import { HomePlanStorageSync, StartMyDay } from "../components/start-my-day";
import { emptyHomePlan, PLAN_STORAGE_KEY } from "../lib/home-plan";
import type { Task } from "../lib/types";
import type { ImageUploadResult } from "../lib/image-client";

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }));
const photos = vi.hoisted(() => ({ uploadImage: vi.fn(), analyzeUploadedImage: vi.fn() }));
const notices = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/image-client", () => photos);
vi.mock("@/components/toast", () => notices);
vi.mock("@/components/lightbox", () => ({ openLightbox: vi.fn() }));
vi.mock("@/components/task-image", () => ({
  TaskImage: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const fetchMock = vi.fn<typeof fetch>();

function savedResponse() {
  return new Response(JSON.stringify({ id: "task-1" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1", task: "Mulch garden", status: "Not Started", priority: "Low", area: "Garden",
    subLocation: null, type: ["Landscaping"], frequency: "One-time", dueDate: null,
    dateCompleted: null, assignedTo: [], contractorVendor: null, costEstimate: 75,
    actualCost: null, notes: null, tags: [], workMode: "DIY", createdTime: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function submittedBody() {
  const init = fetchMock.mock.calls.at(-1)?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  photos.uploadImage.mockReset();
  photos.analyzeUploadedImage.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("task editing through the rendered interface", () => {
  it("keeps the draft and stays in the editor when the server rejects a save", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Storage is unavailable. Please retry." }), { status: 503 }));
    render(<TaskForm mode="create" returnTo="/?list=all" />);

    const name = screen.getByLabelText("What needs doing?") as HTMLInputElement;
    await user.type(name, "Mulch the front garden when my back feels better");
    await user.click(screen.getByRole("button", { name: "Save task" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Storage is unavailable");
    expect(name.value).toBe("Mulch the front garden when my back feels better");
    expect((screen.getByRole("button", { name: "Save task" }) as HTMLButtonElement).disabled).toBe(false);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(notices.showToast).not.toHaveBeenCalled();
  });

  it("completes a task with the currently edited name, notes and actual cost in one save", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(savedResponse());
    render(<TaskForm mode="edit" task={task({ task: "Paint porch", notes: "Use the saved paint." })} returnTo="/calendar?date=2026-10-17" />);

    const name = screen.getByLabelText("What needs doing?");
    await user.clear(name);
    await user.type(name, "Paint front porch");
    await user.click(screen.getByText("More details"));
    await user.type(screen.getByLabelText("Actual cost ($)"), "87.50");
    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Used two coats of the saved paint.");
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    await user.click(screen.getByRole("button", { name: "Complete task" }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/calendar?date=2026-10-17"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tasks/task-1");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(submittedBody()).toMatchObject({
      task: "Paint front porch", status: "Completed", actualCost: 87.5,
      notes: "Used two coats of the saved paint.",
      dateCompleted: { start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    });
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("blocks saving during photo upload and preserves edits made before suggestions finish", async () => {
    const user = userEvent.setup();
    let finishUpload!: (result: ImageUploadResult) => void;
    photos.uploadImage.mockReturnValue(new Promise<ImageUploadResult>((resolve) => { finishUpload = resolve; }));
    fetchMock.mockResolvedValue(savedResponse());
    render(<TaskForm mode="create" returnTo="/?list=all" />);

    const name = screen.getByLabelText("What needs doing?") as HTMLInputElement;
    await user.type(name, "My own repair plan");
    await user.upload(screen.getByLabelText("Choose a task photo"), new File(["image"], "garden.jpg", { type: "image/jpeg" }));

    const pendingSave = screen.getByRole("button", { name: "Waiting for photo…" }) as HTMLButtonElement;
    expect(pendingSave.disabled).toBe(true);
    await user.click(pendingSave);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(name);
    await user.type(name, "My revised repair plan");

    const photoUrl = "https://example.public.blob.vercel-storage.com/photos/garden.jpg";
    await act(async () => {
      finishUpload({
        url: photoUrl,
        classification: { task: "AI replacement title", area: "Garden", type: ["Landscaping"], priority: "Low", costEstimate: 40, description: "Garden maintenance" },
      });
    });
    expect(name.value).toBe("My revised repair plan");
    expect(screen.getByRole("img", { name: "Task photo 1" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedBody()).toMatchObject({ task: "My revised repair plan", area: "Garden" });
    expect(submittedBody().notes).toContain(photoUrl);
  });

  it("retries only scheduling after a saved completion, preserving its date, edits and completion photo", async () => {
    const user = userEvent.setup();
    const completedDate = "2026-10-16";
    const photoUrl = "https://example.public.blob.vercel-storage.com/photos/completed-garden.jpg";
    photos.uploadImage.mockResolvedValue({ url: photoUrl });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: "Your task was saved, but its next occurrence could not be scheduled. Retry completion to finish scheduling it.",
      saved: true,
      recurrencePending: true,
      task: task({ status: "Completed", dateCompleted: { start: completedDate }, nextOccurrencePending: true }),
    }), { status: 502 })).mockResolvedValueOnce(new Response(JSON.stringify({
      ...task({ status: "Completed", dateCompleted: { start: completedDate } }),
      nextOccurrence: task({ id: "next-task", dueDate: { start: "2027-04-15" } }),
    }), { status: 200 }));
    render(<TaskForm mode="edit" task={task({ frequency: "Annually", dueDate: { start: "2026-04-15" } })} returnTo="/?list=all" />);

    const name = screen.getByLabelText("What needs doing?") as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "Mulch completed around the front garden");
    await user.click(screen.getByText("More details"));
    await user.type(screen.getByLabelText("Actual cost ($)"), "62");
    await user.type(screen.getByLabelText("Notes"), "Used the remaining bags first.");
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    await user.upload(screen.getByLabelText("Add completion photo"), new File(["image"], "finished.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Complete task" }));

    const retry = await screen.findByRole("button", { name: "Retry scheduling" });
    expect((await screen.findByRole("alert")).textContent).toContain("Your task was saved");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.refresh).not.toHaveBeenCalled();
    expect(name.value).toBe("Mulch completed around the front garden");
    const status = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(status.value).toBe("Completed");
    expect(status.disabled).toBe(true);
    expect((screen.getByLabelText("Completed on (optional)") as HTMLInputElement).value).toBe(completedDate);
    expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();

    await user.click(retry);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/?list=all"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(submittedBody()).toMatchObject({
      task: "Mulch completed around the front garden",
      status: "Completed",
      actualCost: 62,
      dateCompleted: { start: completedDate },
    });
    expect(submittedBody().notes).toContain("Used the remaining bags first.");
    expect(submittedBody().notes).toContain(`After photo: ${photoUrl}`);
    expect(photos.uploadImage).toHaveBeenCalledTimes(1);
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps dates optional, treats a chosen date as a target, and clears the deadline with the date", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => savedResponse());
    render(<TaskForm mode="create" task={{ task: "Mulch when convenient" }} returnTo="/" />);

    const date = screen.getByLabelText(/Plan for/) as HTMLInputElement;
    expect(date.required).toBe(false);
    expect(date.value).toBe("");
    expect(screen.getByText("Date options").closest("details")?.open).toBe(false);
    await user.click(screen.getByText("Date options"));
    const deadline = screen.getByRole("checkbox", { name: "Firm deadline" }) as HTMLInputElement;
    expect(deadline.checked).toBe(false);
    expect(deadline.disabled).toBe(true);

    fireEvent.change(date, { target: { value: "2026-04-15" } });
    expect(deadline.disabled).toBe(false);
    expect(deadline.checked).toBe(false);
    await user.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedBody()).toMatchObject({ dueDate: { start: "2026-04-15" }, isDeadline: false });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save task" }) as HTMLButtonElement).disabled).toBe(false));

    await user.click(deadline);
    expect(deadline.checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(date.value).toBe("");
    expect(deadline.checked).toBe(false);
    expect(deadline.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(submittedBody().isDeadline).toBe(false);
    expect(submittedBody()).not.toHaveProperty("dueDate");
  });
});

it("displays a missed target neutrally while keeping a genuine missed deadline identifiable", () => {
  render(<>
    <TaskCard task={task({ id: "target", task: "Optional garden mulch", dueDate: { start: "2000-04-15" }, isDeadline: false })} />
    <TaskCard task={task({ id: "deadline", task: "Inspection appointment", dueDate: { start: "2000-04-15" }, isDeadline: true })} />
  </>);

  const target = screen.getByRole("heading", { name: "Optional garden mulch" }).closest("article")!;
  const deadline = screen.getByRole("heading", { name: "Inspection appointment" }).closest("article")!;
  expect(within(target).getByText("Planned for Apr 15, 2000")).toBeTruthy();
  expect(within(target).queryByText(/overdue|deadline passed/i)).toBeNull();
  expect(within(deadline).getByText("Deadline passed: Apr 15, 2000")).toBeTruthy();
});

describe("completion stays clear before refreshed server data arrives", () => {
  it("removes a completed task immediately, explains its next repeat, and ignores double submissions", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    render(<TaskCard task={task({ frequency: "Annually", dueDate: { start: "2026-04-15" } })} />);
    const status = screen.getByRole("combobox", { name: "Status for Mulch garden" });
    fireEvent.change(status, { target: { value: "Completed" } });
    fireEvent.change(status, { target: { value: "Completed" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Mulch garden" })).toBeTruthy();

    await act(async () => finish(new Response(JSON.stringify({ ...task({ status: "Completed" }), nextOccurrence: task({ id: "next", dueDate: { start: "2027-04-15" } }) }), { status: 200 })));
    expect(screen.queryByRole("heading", { name: "Mulch garden" })).toBeNull();
    expect(notices.showToast).toHaveBeenCalledWith("Completed. Next repeat: Apr 15, 2027.", "success");
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("makes future repeats viewable without inviting another quick completion", () => {
    render(<TaskCard task={task({ frequency: "Annually", dueDate: { start: "2099-04-15" } })} />);
    expect(screen.getByText("Next repeat: Apr 15, 2099")).toBeTruthy();
    expect(screen.getByText("No action needed now.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to plan" })).toBeNull();
    expect(screen.getByRole("link", { name: "View or reschedule" }).getAttribute("href")).toContain("/task/task-1");
  });

  it("restores the card after a rejected completion, and keeps a direct recovery link for saved pending scheduling", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Unavailable" }), { status: 503 }));
    render(<TaskCard task={task()} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Status for Mulch garden" }), "Completed");
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Status for Mulch garden" }) as HTMLSelectElement).value).toBe("Not Started"));
    expect(screen.getByText(/previous value has been restored/)).toBeTruthy();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ saved: true, recurrencePending: true, error: "Completion saved; scheduling needs retry." }), { status: 502 }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Status for Mulch garden" }), "Completed");
    expect(await screen.findByRole("link", { name: "Finish scheduling next repeat" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("removes finished plan cards, frees their slots, and keeps future repeats out of the plan", async () => {
    const user = userEvent.setup();
    const tasks = ["A", "B", "C", "D"].map((letter) => task({ id: letter, task: `Inspect ${letter}` }));
    const future = task({ id: "future", task: "Next year's inspection", frequency: "Annually", dueDate: { start: "2099-04-15" } });
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...emptyHomePlan(), budgetMinutes: 120, selectedIds: ["A", "B", "C"] }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...tasks[0], status: "Completed", nextOccurrence: future }), { status: 200 }));
    render(<StartMyDay tasks={[...tasks, future]} />);
    expect(screen.queryByRole("button", { name: "Complete Next year's inspection" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Complete Inspect A" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Complete Inspect A" })).toBeNull());
    expect(screen.getByText(/Inspect A: Completed. Next repeat: Apr 15, 2099/)).toBeTruthy();
    const suggestion = screen.getByRole("link", { name: "Inspect D" }).closest("article")!;
    await user.click(within(suggestion).getByRole("button", { name: "Add to plan" }));
    const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY)!);
    expect(saved.selectedIds).toEqual(["B", "C", "D"]);
    expect(screen.getByRole("button", { name: "Complete Inspect D" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Choose from all tasks/ })).toBeNull();
  });

  it("cleans completed picks before adding tasks from the full list", () => {
    const completed = task({ id: "done", status: "Completed" });
    const active = task({ id: "active" });
    const future = task({ id: "future", frequency: "Annually", dueDate: { start: "2099-04-15" } });
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ ...emptyHomePlan(), selectedIds: ["done", "active", "future"] }));
    render(<HomePlanStorageSync tasks={[completed, active, future]} />);
    expect(JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY)!).selectedIds).toEqual(["active"]);
  });
});
