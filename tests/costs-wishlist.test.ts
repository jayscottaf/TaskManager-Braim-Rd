import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), retrieve: vi.fn(), update: vi.fn(), children: vi.fn(), database: vi.fn(), updateDatabase: vi.fn(), createDatabase: vi.fn(), createPage: vi.fn(), createTask: vi.fn(), findWishlistTask: vi.fn() }));
vi.mock("@notionhq/client", () => ({ Client: class { blocks = { children: { list: mocks.children } }; databases = { query: mocks.query, retrieve: mocks.database, update: mocks.updateDatabase, create: mocks.createDatabase }; pages = { retrieve: mocks.retrieve, update: mocks.update, create: mocks.createPage }; } }));
vi.mock("@/lib/notion", () => ({ createTask: mocks.createTask, findWishlistTask: mocks.findWishlistTask }));
vi.mock("@/lib/feature-db", () => ({ FEATURES_PAGE_ID: "features" }));

function source(id = "idea") {
  return { id, parent: { type: "database_id", database_id: "wishlist" }, properties: {
    Project: { type: "title", title: [{ plain_text: "Mulch" }] },
    "DIY Cost": { type: "number", number: 75 },
    _Status: { type: "select", select: { name: "Active" } },
  } };
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  // No schema write is needed for test fixtures; missing property sync is mocked too.
  mocks.children.mockResolvedValue({ results: [{ id: "wishlist", type: "child_database", child_database: { title: "Wish List" } }], has_more: false });
  mocks.database.mockResolvedValue({ id: "wishlist", title: [{ plain_text: "Wish List" }], properties: {} });
  mocks.updateDatabase.mockResolvedValue({});
  mocks.retrieve.mockResolvedValue(source());
  mocks.update.mockResolvedValue({});
  mocks.createTask.mockResolvedValue({ id: "new-task" });
  mocks.findWishlistTask.mockResolvedValue(null);
});

describe("wishlist promotion", () => {
  it("creates one linked task and archives the idea after creation succeeds", async () => {
    const { promoteWishListItem } = await import("@/lib/wishlist");
    const results = await Promise.all([promoteWishListItem("idea", { start: "2026-10-20" }), promoteWishListItem("idea", { start: "2026-10-20" })]);
    expect(results[0].taskId).toBe("new-task");
    expect(results[1].taskId).toBe("new-task");
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({ costEstimate: 75, dueDate: { start: "2026-10-20" } }), undefined, { wishlistSourceId: "idea" });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ _Status: { select: { name: "Archived" } }, "Promoted Task ID": expect.any(Object) }) }));
  });

  it("recovers a created task if the source link/archive write failed", async () => {
    const { promoteWishListItem } = await import("@/lib/wishlist");
    mocks.update.mockRejectedValueOnce(new Error("Notion temporarily unavailable"));
    await expect(promoteWishListItem("idea")).rejects.toThrow();
    mocks.findWishlistTask.mockResolvedValue({ id: "new-task" });
    await expect(promoteWishListItem("idea")).resolves.toEqual({ taskId: "new-task", recovered: true });
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(mocks.findWishlistTask).toHaveBeenLastCalledWith("idea");
  });

  it("does not archive an idea when creating the task fails", async () => {
    const { promoteWishListItem } = await import("@/lib/wishlist");
    mocks.createTask.mockRejectedValue(new Error("No task saved"));
    await expect(promoteWishListItem("idea")).rejects.toThrow("No task saved");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reuses an already linked source on retry", async () => {
    const { promoteWishListItem } = await import("@/lib/wishlist");
    const item = source();
    Object.assign(item.properties, { "Promoted Task ID": { type: "rich_text", rich_text: [{ plain_text: "linked-task" }] } });
    mocks.retrieve.mockResolvedValue(item);
    await expect(promoteWishListItem("idea")).resolves.toEqual({ taskId: "linked-task", recovered: true });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});

describe("complete wishlist reads", () => {
  it("retrieves every Notion page and shares cached active/archived reads", async () => {
    const { getWishListItems } = await import("@/lib/wishlist");
    mocks.query.mockResolvedValueOnce({ results: [source("first")], has_more: true, next_cursor: "cursor" }).mockResolvedValueOnce({ results: [source("second")], has_more: false });
    expect((await getWishListItems()).map((item) => item.id)).toEqual(["first", "second"]);
    expect((await getWishListItems(true))).toHaveLength(2);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ start_cursor: "cursor" }));
  });
});


describe("wishlist database setup", () => {
  it("does not create a duplicate database when schema sync fails", async () => {
    const { getOrCreateDatabase } = await import("@/lib/wishlist");
    mocks.updateDatabase.mockRejectedValue(new Error("Schema update unavailable"));
    await expect(getOrCreateDatabase()).rejects.toThrow("Schema update unavailable");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });
});
