// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskForm } from "../components/task-form";
import type { Task } from "../lib/types";

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }));
const photos = vi.hoisted(() => ({ uploadImage: vi.fn(), analyzeUploadedImage: vi.fn() }));
const notices = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/image-client", () => photos);
vi.mock("@/components/toast", () => notices);
vi.mock("@/components/lightbox", () => ({ openLightbox: vi.fn() }));
vi.mock("@/lib/household-date", () => ({ householdDateKey: () => "2026-10-17" }));
vi.mock("@/components/task-image", () => ({
  TaskImage: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const fetchMock = vi.fn<typeof fetch>();

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "roof-repeat", task: "Inspect roof", status: "Not Started", priority: "High", area: "Roof",
    subLocation: null, type: ["General Repair"], frequency: "Annually", dueDate: { start: "2028-04-15" },
    dateCompleted: null, assignedTo: [], contractorVendor: null, costEstimate: null,
    actualCost: null, notes: null, tags: [], workMode: "DIY", createdTime: "2026-10-17T17:00:00Z",
    ...overrides,
  };
}

function submittedBody(call = -1): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls.at(call)?.[1]?.body));
}

function savedResponse() {
  return new Response(JSON.stringify({ id: "roof-repeat", status: "Completed" }), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  photos.uploadImage.mockReset();
  photos.analyzeUploadedImage.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("completing a future repeat from the editor", () => {
  it("keeps completion review as the only save action rather than silently saving unfinished work", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(savedResponse());
    render(<TaskForm mode="edit" task={task({ frequency: "One-time", dueDate: null })} returnTo="/?list=all" />);
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    fireEvent.submit(screen.getByLabelText("What needs doing?").closest("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Complete task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedBody().status).toBe("Completed");
  });

  it("names the repeat's year and requires the explicit early completion action", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(savedResponse());
    render(<TaskForm mode="edit" task={task()} returnTo="/?list=all" />);

    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    const review = screen.getByRole("region", { name: "Review task completion" });
    expect(review.textContent).toContain("This repeat is planned for Apr 15, 2028. Complete it early?");
    expect(document.activeElement).toBe(review);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(within(review).getByRole("button", { name: "Complete this repeat early" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedBody()).toMatchObject({ status: "Completed", confirmEarlyCompletion: true, dueDate: { start: "2028-04-15" } });
    expect(navigation.push).toHaveBeenCalledWith("/?list=all");
  });

  it("also reviews a Completed status selection and cancels without losing draft edits", async () => {
    const user = userEvent.setup();
    render(<TaskForm mode="edit" task={task()} returnTo="/?list=all" />);

    const name = screen.getByLabelText("What needs doing?") as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "Inspect roof and flashing");
    await user.click(screen.getByText("More details"));
    await user.type(screen.getByLabelText("Notes"), "Bring the longer ladder.");
    await user.selectOptions(screen.getByLabelText("Status"), "Completed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).not.toHaveBeenCalled();
    const review = screen.getByRole("region", { name: "Review task completion" });
    expect(within(review).getByRole("button", { name: "Complete this repeat early" })).toBeTruthy();
    await user.click(within(review).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Review task completion" })).toBeNull();
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("Not Started");
    expect(name.value).toBe("Inspect roof and flashing");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("Bring the longer ladder.");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("recovers a server early-repeat warning while retaining edits and the uploaded completion photo", async () => {
    const user = userEvent.setup();
    const photoUrl = "https://example.public.blob.vercel-storage.com/photos/finished-roof.jpg";
    photos.uploadImage.mockResolvedValue({ url: photoUrl });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      code: "EARLY_RECURRENCE_COMPLETION",
      error: "This repeat is planned for Apr 15, 2028. Confirm before completing it early.",
      plannedFor: "2028-04-15",
      task: task(),
    }), { status: 409 })).mockResolvedValueOnce(savedResponse());
    render(<TaskForm mode="edit" task={task({ dueDate: { start: "2026-04-15" } })} returnTo="/?list=all" />);

    await user.click(screen.getByText("More details"));
    await user.type(screen.getByLabelText("Notes"), "Checked the flashing too.");
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    await user.upload(screen.getByLabelText("Add completion photo"), new File(["image"], "finished.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Complete task" }));

    const confirm = await screen.findByRole("button", { name: "Complete this repeat early" });
    expect(screen.getByText("This repeat is planned for Apr 15, 2028. Complete it early?")).toBeTruthy();
    expect(screen.getByRole("img", { name: "New completion photo" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(submittedBody()).not.toHaveProperty("confirmEarlyCompletion");

    await user.click(confirm);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/?list=all"));
    expect(submittedBody()).toMatchObject({ status: "Completed", confirmEarlyCompletion: true });
    expect(submittedBody().notes).toContain("Checked the flashing too.");
    expect(submittedBody().notes).toContain(`After photo: ${photoUrl}`);
    expect(photos.uploadImage).toHaveBeenCalledTimes(1);
  });

  it("allows regular future one-time work and edits to an already completed repeat without an extra confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => savedResponse());
    const view = render(<TaskForm mode="edit" task={task({ frequency: "One-time" })} returnTo="/?list=all" />);
    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    await user.click(screen.getByRole("button", { name: "Complete task" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedBody()).not.toHaveProperty("confirmEarlyCompletion");

    view.unmount();
    render(<TaskForm mode="edit" task={task({ status: "Completed", dateCompleted: { start: "2026-10-17" } })} returnTo="/?list=all" />);
    fireEvent.change(screen.getByLabelText("What needs doing?"), { target: { value: "Roof inspected; update notes" } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("region", { name: "Review task completion" })).toBeNull();
    expect(submittedBody()).toMatchObject({ task: "Roof inspected; update notes", status: "Completed" });
    expect(submittedBody()).not.toHaveProperty("confirmEarlyCompletion");
  });
});
