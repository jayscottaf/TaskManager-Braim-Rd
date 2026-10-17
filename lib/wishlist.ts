import { Client } from "@notionhq/client";
import type { DatabaseObjectResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FEATURES_PAGE_ID } from "./feature-db";
import { CACHE_TTL, clearCachePrefix, getOrLoadCached } from "./cache";
import { createTask, findWishlistTask } from "./notion";
import type { Area, TaskType, Priority } from "./types";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB_TITLE = "Wish List";

export interface WishListItem {
  id: string;
  project: string;
  description: string;
  aiPlan: string;
  diyCost: number | null;
  hiredCost: number | null;
  valueAdd: number | null;
  diyRoi: number | null;
  hiredRoi: number | null;
  diyRoiRating: string | null;
  hiredRoiRating: string | null;
  diyDifficulty: string | null;
  costMode: string; // "DIY" | "Hired Out"
  category: string | null;
  priority: string | null;
  timeline: string | null;
  bestSeason: string | null;
  photos: string[];
  tags: string[];
  notes: string | null;
  _status: string;
  promotedTaskId?: string | null;
}

import { getActiveCost } from "./wishlist-values";
export { getActiveCost, getActiveRoi, getActiveRoiRating } from "./wishlist-values";

export interface CreateWishListInput {
  project: string;
  description?: string;
  aiPlan?: string;
  diyCost?: number | null;
  hiredCost?: number | null;
  valueAdd?: number | null;
  diyRoi?: number | null;
  hiredRoi?: number | null;
  diyRoiRating?: string;
  hiredRoiRating?: string;
  diyDifficulty?: string;
  costMode?: string;
  category?: string;
  priority?: string;
  timeline?: string;
  bestSeason?: string;
  photos?: string[];
  tags?: string[];
  notes?: string;
}

const ROI_OPTIONS = [
  { name: "High ROI" },
  { name: "Good" },
  { name: "Low" },
  { name: "Lifestyle" },
];

// Database schema definition
const DB_PROPERTIES = {
  Project: { title: {} },
  Description: { rich_text: {} },
  "AI Plan": { rich_text: {} },
  "DIY Cost": { number: { format: "dollar" as const } },
  "Hired Cost": { number: { format: "dollar" as const } },
  "Value Add": { number: { format: "dollar" as const } },
  "DIY ROI": { number: { format: "percent" as const } },
  "Hired ROI": { number: { format: "percent" as const } },
  "DIY ROI Rating": { select: { options: ROI_OPTIONS } },
  "Hired ROI Rating": { select: { options: ROI_OPTIONS } },
  "DIY Difficulty": {
    select: {
      options: [
        { name: "Easy" },
        { name: "Moderate" },
        { name: "Hard" },
        { name: "Pro Only" },
      ],
    },
  },
  "Cost Mode": {
    select: {
      options: [{ name: "DIY" }, { name: "Hired Out" }],
    },
  },
  Category: {
    select: {
      options: [
        { name: "Landscaping" },
        { name: "Driveway" },
        { name: "Interior" },
        { name: "Exterior" },
        { name: "Roofing" },
        { name: "Plumbing" },
        { name: "Electrical" },
        { name: "General" },
      ],
    },
  },
  Priority: {
    select: {
      options: [{ name: "High" }, { name: "Medium" }, { name: "Low" }],
    },
  },
  Timeline: {
    select: {
      options: [
        { name: "This Year" },
        { name: "Next Year" },
        { name: "2+ Years" },
        { name: "Someday" },
      ],
    },
  },
  "Best Season": {
    select: {
      options: [
        { name: "Spring" },
        { name: "Summer" },
        { name: "Fall" },
        { name: "Winter" },
        { name: "Any" },
      ],
    },
  },
  Photos: { rich_text: {} },
  Tags: { multi_select: { options: [] } },
  Notes: { rich_text: {} },
  "Promoted Task ID": { rich_text: {} },
  _Status: {
    select: {
      options: [{ name: "Active" }, { name: "Archived" }],
    },
  },
};

/**
 * Find or create the Wish List database under the features parent page.
 */
let cachedDbId: string | null = null;
let databasePromise: Promise<string> | null = null;

export async function getOrCreateDatabase(): Promise<string> {
  if (cachedDbId) return cachedDbId;
  if (!databasePromise) {
    databasePromise = resolveDatabase().then((id) => { cachedDbId = id; return id; }).finally(() => { databasePromise = null; });
  }
  return databasePromise;
}

async function resolveDatabase(): Promise<string> {
  let cursor: string | undefined;
  do {
    const children = await notion.blocks.children.list({ block_id: FEATURES_PAGE_ID, page_size: 100, start_cursor: cursor });
    for (const block of children.results) {
      if (!("type" in block) || block.type !== "child_database" || block.child_database.title !== DB_TITLE) continue;
      const db = await notion.databases.retrieve({ database_id: block.id }) as DatabaseObjectResponse;
      if (db.archived || db.title.map((t) => t.plain_text).join("") !== DB_TITLE) continue;
      // Schema failures must not fall through and create a second database.
      const existing = new Set(Object.keys(db.properties));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missing: Record<string, any> = {};
      for (const [key, value] of Object.entries(DB_PROPERTIES)) {
        if (key !== "Project" && !existing.has(key)) missing[key] = value;
      }
      if (Object.keys(missing).length > 0) await notion.databases.update({ database_id: db.id, properties: missing });
      return db.id;
    }
    cursor = children.has_more ? children.next_cursor ?? undefined : undefined;
  } while (cursor);
  const db = await notion.databases.create({ parent: { page_id: FEATURES_PAGE_ID }, title: [{ text: { content: DB_TITLE } }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: DB_PROPERTIES as any });
  return db.id;
}

const WISHLIST_CACHE_PREFIX = "wishlist:";
function invalidateWishList() { clearCachePrefix(WISHLIST_CACHE_PREFIX); }

/** Notion rich_text blocks have a 2000-char limit. Split long strings into chunks. */
function richTextChunks(text: string): { text: { content: string } }[] {
  const MAX = 2000;
  if (text.length <= MAX) return [{ text: { content: text } }];
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += MAX) {
    chunks.push({ text: { content: text.slice(i, i + MAX) } });
  }
  return chunks;
}

function parsePhotos(raw: string): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { /* ignore */ }
  if (raw.startsWith("http")) return [raw];
  return [];
}

function pctToDisplay(raw: number | null): number | null {
  return raw != null ? Math.round(raw * 100) : null;
}

function pageToItem(page: PageObjectResponse): WishListItem {
  const p = page.properties;

  function getTitle(): string {
    const prop = p["Project"];
    if (prop?.type === "title") return prop.title.map((t) => t.plain_text).join("");
    return "";
  }
  function getRichText(name: string): string {
    const prop = p[name];
    if (prop?.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
    return "";
  }
  function getNumber(name: string): number | null {
    const prop = p[name];
    if (prop?.type === "number") return prop.number;
    return null;
  }
  function getSelect(name: string): string | null {
    const prop = p[name];
    if (prop?.type === "select") return prop.select?.name ?? null;
    return null;
  }

  // Backward compat: old items have "Estimated Cost"/"ROI"/"ROI Rating" instead of new fields
  const diyCost = getNumber("DIY Cost") ?? getNumber("Estimated Cost");
  const diyRoi = pctToDisplay(getNumber("DIY ROI") ?? getNumber("ROI"));
  const diyRoiRating = getSelect("DIY ROI Rating") ?? getSelect("ROI Rating");

  return {
    id: page.id,
    project: getTitle(),
    description: getRichText("Description"),
    aiPlan: getRichText("AI Plan"),
    diyCost,
    hiredCost: getNumber("Hired Cost"),
    valueAdd: getNumber("Value Add"),
    diyRoi,
    hiredRoi: pctToDisplay(getNumber("Hired ROI")),
    diyRoiRating,
    hiredRoiRating: getSelect("Hired ROI Rating"),
    diyDifficulty: getSelect("DIY Difficulty"),
    costMode: getSelect("Cost Mode") || "DIY",
    category: getSelect("Category"),
    priority: getSelect("Priority"),
    timeline: getSelect("Timeline"),
    bestSeason: getSelect("Best Season"),
    photos: parsePhotos(getRichText("Photos")),
    tags: (() => {
      const prop = p.Tags;
      if (prop?.type === "multi_select") return prop.multi_select.map((o: { name: string }) => o.name);
      return [];
    })(),
    notes: getRichText("Notes"),
    _status: getSelect("_Status") || "Active",
    promotedTaskId: getRichText("Promoted Task ID") || null,
  };
}

export async function getWishListItems(showArchived = false): Promise<WishListItem[]> {
  const items = await getOrLoadCached(`${WISHLIST_CACHE_PREFIX}all`, CACHE_TTL.TASK_LIST, async () => {
    const dbId = await getOrCreateDatabase();
    const all: WishListItem[] = [];
    let cursor: string | undefined;
    do {
      const response = await notion.databases.query({ database_id: dbId, page_size: 100, start_cursor: cursor });
      all.push(...response.results.filter((page): page is PageObjectResponse => "properties" in page).map(pageToItem));
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
    return all;
  });
  return showArchived ? items : items.filter((item) => item._status !== "Archived" && !item.promotedTaskId);
}

export async function getWishListItem(id: string): Promise<WishListItem> {
  const page = await notion.pages.retrieve({ page_id: id });
  if (!("properties" in page) || page.archived) throw new Error("Wishlist item is unavailable");
  const dbId = await getOrCreateDatabase();
  if (page.parent.type !== "database_id" || page.parent.database_id !== dbId) throw new Error("Wishlist item is unavailable");
  return pageToItem(page);
}

export async function createWishListItem(input: CreateWishListInput): Promise<string> {
  const dbId = await getOrCreateDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    Project: { title: [{ text: { content: input.project } }] },
    _Status: { select: { name: "Active" } },
  };

  if (input.description) properties.Description = { rich_text: richTextChunks(input.description) };
  if (input.aiPlan) properties["AI Plan"] = { rich_text: richTextChunks(input.aiPlan) };
  if (input.diyCost != null) properties["DIY Cost"] = { number: input.diyCost };
  if (input.hiredCost != null) properties["Hired Cost"] = { number: input.hiredCost };
  if (input.valueAdd != null) properties["Value Add"] = { number: input.valueAdd };
  if (input.diyRoi != null) properties["DIY ROI"] = { number: input.diyRoi / 100 };
  if (input.hiredRoi != null) properties["Hired ROI"] = { number: input.hiredRoi / 100 };
  if (input.diyRoiRating) properties["DIY ROI Rating"] = { select: { name: input.diyRoiRating } };
  if (input.hiredRoiRating) properties["Hired ROI Rating"] = { select: { name: input.hiredRoiRating } };
  if (input.diyDifficulty) properties["DIY Difficulty"] = { select: { name: input.diyDifficulty } };
  if (input.costMode) properties["Cost Mode"] = { select: { name: input.costMode } };
  if (input.category) properties.Category = { select: { name: input.category } };
  if (input.priority) properties.Priority = { select: { name: input.priority } };
  if (input.timeline) properties.Timeline = { select: { name: input.timeline } };
  if (input.bestSeason) {
    const season = input.bestSeason.split("(")[0].trim();
    properties["Best Season"] = { select: { name: season } };
  }
  if (input.photos && input.photos.length > 0) properties.Photos = { rich_text: richTextChunks(JSON.stringify(input.photos)) };
  if (input.tags && input.tags.length > 0) properties.Tags = { multi_select: input.tags.map((t) => ({ name: t })) };
  if (input.notes) properties.Notes = { rich_text: richTextChunks(input.notes) };

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties,
  }).finally(invalidateWishList);
  return page.id;
}

export async function updateWishListItem(
  pageId: string,
  updates: Partial<CreateWishListInput> & { _action?: string }
): Promise<void> {
  if (updates._action === "archive" || updates._action === "restore") {
    if (updates._action === "restore" && (await getWishListItem(pageId)).promotedTaskId) throw new Error("This idea already has a task. Open the linked task instead.");
    const statusValue = updates._action === "archive" ? "Archived" : "Active";
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: { _Status: { select: { name: statusValue } } },
      });
    } catch {
      await getOrCreateDatabase();
      await notion.pages.update({
        page_id: pageId,
        properties: { _Status: { select: { name: statusValue } } },
      });
    }
    invalidateWishList();
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (updates.project !== undefined) properties.Project = { title: [{ text: { content: updates.project } }] };
  if (updates.description !== undefined) properties.Description = { rich_text: updates.description ? richTextChunks(updates.description) : [] };
  if (updates.aiPlan !== undefined) properties["AI Plan"] = { rich_text: updates.aiPlan ? richTextChunks(updates.aiPlan) : [] };
  if (updates.diyCost !== undefined) properties["DIY Cost"] = { number: updates.diyCost ?? null };
  if (updates.hiredCost !== undefined) properties["Hired Cost"] = { number: updates.hiredCost ?? null };
  if (updates.valueAdd !== undefined) properties["Value Add"] = { number: updates.valueAdd ?? null };
  if (updates.diyRoi !== undefined) properties["DIY ROI"] = { number: updates.diyRoi != null ? updates.diyRoi / 100 : null };
  if (updates.hiredRoi !== undefined) properties["Hired ROI"] = { number: updates.hiredRoi != null ? updates.hiredRoi / 100 : null };
  if (updates.diyRoiRating !== undefined) properties["DIY ROI Rating"] = updates.diyRoiRating ? { select: { name: updates.diyRoiRating } } : { select: null };
  if (updates.hiredRoiRating !== undefined) properties["Hired ROI Rating"] = updates.hiredRoiRating ? { select: { name: updates.hiredRoiRating } } : { select: null };
  if (updates.diyDifficulty !== undefined) properties["DIY Difficulty"] = updates.diyDifficulty ? { select: { name: updates.diyDifficulty } } : { select: null };
  if (updates.costMode !== undefined) properties["Cost Mode"] = updates.costMode ? { select: { name: updates.costMode } } : { select: null };
  if (updates.category !== undefined) properties.Category = updates.category ? { select: { name: updates.category } } : { select: null };
  if (updates.priority !== undefined) properties.Priority = updates.priority ? { select: { name: updates.priority } } : { select: null };
  if (updates.timeline !== undefined) properties.Timeline = updates.timeline ? { select: { name: updates.timeline } } : { select: null };
  if (updates.bestSeason !== undefined) {
    if (updates.bestSeason) {
      const season = updates.bestSeason.split("(")[0].trim();
      properties["Best Season"] = { select: { name: season } };
    } else {
      properties["Best Season"] = { select: null };
    }
  }
  if (updates.photos !== undefined) properties.Photos = { rich_text: updates.photos && updates.photos.length > 0 ? richTextChunks(JSON.stringify(updates.photos)) : [] };
  if (updates.tags !== undefined) properties.Tags = { multi_select: (updates.tags ?? []).map((t) => ({ name: t })) };
  if (updates.notes !== undefined) properties.Notes = updates.notes ? { rich_text: richTextChunks(updates.notes) } : { rich_text: [] };

  if (Object.keys(properties).length > 0) {
    await notion.pages.update({ page_id: pageId, properties }).finally(invalidateWishList);
  }
}

export async function deleteWishListItem(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true }).finally(invalidateWishList);
}

const promotionLocks = new Map<string, Promise<{ taskId: string; recovered: boolean }>>();

/** Notion has no multi-page transaction. Persisted source identity lets retries recover a created task before archiving its idea. */
export async function promoteWishListItem(id: string, date?: { start: string; end?: string }): Promise<{ taskId: string; recovered: boolean }> {
  const active = promotionLocks.get(id);
  if (active) return active;
  const operation = promoteItem(id, date).finally(() => { promotionLocks.delete(id); });
  promotionLocks.set(id, operation);
  return operation;
}

async function promoteItem(id: string, date?: { start: string; end?: string }): Promise<{ taskId: string; recovered: boolean }> {
  // Reading directly also checks that the source belongs to this wishlist database.
  const item = await getWishListItem(id);
  let taskId = item.promotedTaskId ?? null;
  if (!taskId) taskId = (await findWishlistTask(id))?.id ?? null;
  const recovered = taskId != null;
  if (!taskId) {
    if (item._status === "Archived") throw new Error("Restore this idea before adding it to tasks");
    const category = item.category ?? "General";
    const area: Record<string, Area> = { Landscaping: "Garden", Driveway: "Driveway/Walkway", Interior: "Living Room", Exterior: "Exterior", Roofing: "Roof", Plumbing: "Bathroom", Electrical: "Living Room", General: "Exterior" };
    const type: Record<string, TaskType> = { Landscaping: "Landscaping", Driveway: "General Repair", Interior: "Carpentry", Exterior: "Carpentry", Roofing: "General Repair", Plumbing: "Plumbing", Electrical: "Electrical", General: "General Repair" };
    const notes = [item.description, item.aiPlan ? `AI Plan:\n${item.aiPlan}` : "", item.notes, item.photos.length ? `Photos:\n${item.photos.join("\n")}` : ""].filter(Boolean).join("\n\n");
    const task = await createTask({
      task: item.project, status: "Not Started", priority: (["High", "Medium", "Low"].includes(item.priority ?? "") ? item.priority : "Medium") as Priority,
      area: area[category] ?? "Exterior", type: [type[category] ?? "General Repair"], frequency: "One-time", workMode: item.costMode === "Hired Out" ? "Contractor" : "DIY",
      ...(getActiveCost(item) != null ? { costEstimate: getActiveCost(item)! } : {}), ...(date ? { dueDate: date } : {}), notes, tags: item.tags,
    }, undefined, { wishlistSourceId: id });
    taskId = task.id;
  }
  // Link and archive together. If this write fails, retry finds the stored source identity and reuses the task.
  await notion.pages.update({ page_id: id, properties: { "Promoted Task ID": { rich_text: richTextChunks(taskId) }, _Status: { select: { name: "Archived" } } } }).finally(invalidateWishList);
  return { taskId, recovered };
}
