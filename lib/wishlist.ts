import { Client } from "@notionhq/client";
import type { DatabaseObjectResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FEATURES_PAGE_ID } from "./feature-db";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DB_TITLE = "Wish List";

export interface WishListItem {
  id: string;
  project: string;
  description: string;
  aiPlan: string;
  estimatedCost: number | null;
  valueAdd: number | null;
  roi: number | null;
  roiRating: string | null;
  category: string | null;
  priority: string | null;
  timeline: string | null;
  bestSeason: string | null;
  photos: string[];
  notes: string | null;
  _status: string;
}

export interface CreateWishListInput {
  project: string;
  description?: string;
  aiPlan?: string;
  estimatedCost?: number;
  valueAdd?: number;
  roi?: number;
  roiRating?: string;
  category?: string;
  priority?: string;
  timeline?: string;
  bestSeason?: string;
  photos?: string[];
  notes?: string;
}

// Database schema definition
const DB_PROPERTIES = {
  Project: { title: {} },
  Description: { rich_text: {} },
  "AI Plan": { rich_text: {} },
  "Estimated Cost": { number: { format: "dollar" as const } },
  "Value Add": { number: { format: "dollar" as const } },
  ROI: { number: { format: "percent" as const } },
  "ROI Rating": {
    select: {
      options: [
        { name: "High ROI" },
        { name: "Good" },
        { name: "Low" },
        { name: "Lifestyle" },
      ],
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
  Notes: { rich_text: {} },
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

export async function getOrCreateDatabase(): Promise<string> {
  if (cachedDbId) return cachedDbId;

  // Search for existing
  const children = await notion.blocks.children.list({
    block_id: FEATURES_PAGE_ID,
    page_size: 100,
  });

  for (const block of children.results) {
    if (!("type" in block) || block.type !== "child_database") continue;
    try {
      const db = await notion.databases.retrieve({
        database_id: block.id,
      }) as DatabaseObjectResponse;
      if (db.archived) continue;
      const title = db.title.map((t) => t.plain_text).join("");
      if (title === DB_TITLE) {
        cachedDbId = db.id;

        // Sync schema — add any missing properties
        const existing = new Set(Object.keys(db.properties));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const missing: Record<string, any> = {};
        for (const [key, val] of Object.entries(DB_PROPERTIES)) {
          if (key === "Project") continue; // title always exists
          if (!existing.has(key)) missing[key] = val;
        }
        if (Object.keys(missing).length > 0) {
          await notion.databases.update({ database_id: db.id, properties: missing });
        }

        return db.id;
      }
    } catch {
      continue;
    }
  }

  // Create new
  const db = await notion.databases.create({
    parent: { page_id: FEATURES_PAGE_ID },
    title: [{ text: { content: DB_TITLE } }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: DB_PROPERTIES as any,
  });

  cachedDbId = db.id;
  return db.id;
}

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
  // Legacy: single URL stored as plain text
  if (raw.startsWith("http")) return [raw];
  return [];
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
  function getUrl(name: string): string | null {
    const prop = p[name];
    if (prop?.type === "url") return prop.url;
    return null;
  }

  return {
    id: page.id,
    project: getTitle(),
    description: getRichText("Description"),
    aiPlan: getRichText("AI Plan"),
    estimatedCost: getNumber("Estimated Cost"),
    valueAdd: getNumber("Value Add"),
    roi: getNumber("ROI") != null ? Math.round(getNumber("ROI")! * 100) : null,
    roiRating: getSelect("ROI Rating"),
    category: getSelect("Category"),
    priority: getSelect("Priority"),
    timeline: getSelect("Timeline"),
    bestSeason: getSelect("Best Season"),
    photos: parsePhotos(getRichText("Photos")),
    notes: getRichText("Notes"),
    _status: getSelect("_Status") || "Active",
  };
}

export async function getWishListItems(showArchived = false): Promise<WishListItem[]> {
  const dbId = await getOrCreateDatabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryOpts: any = { database_id: dbId };

  if (!showArchived) {
    queryOpts.filter = {
      or: [
        { property: "_Status", select: { equals: "Active" } },
        { property: "_Status", select: { is_empty: true } },
      ],
    };
  }

  let response;
  try {
    response = await notion.databases.query(queryOpts);
  } catch {
    response = await notion.databases.query({ database_id: dbId });
  }

  const items = response.results
    .filter((p): p is PageObjectResponse => "properties" in p)
    .map(pageToItem);

  return showArchived ? items : items.filter((i) => i._status !== "Archived");
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
  if (input.estimatedCost != null) properties["Estimated Cost"] = { number: input.estimatedCost };
  if (input.valueAdd != null) properties["Value Add"] = { number: input.valueAdd };
  if (input.roi != null) properties.ROI = { number: input.roi / 100 }; // Notion percent format is 0-1
  if (input.roiRating) properties["ROI Rating"] = { select: { name: input.roiRating } };
  if (input.category) properties.Category = { select: { name: input.category } };
  if (input.priority) properties.Priority = { select: { name: input.priority } };
  if (input.timeline) properties.Timeline = { select: { name: input.timeline } };
  if (input.bestSeason) {
    // Strip parenthetical reason, just keep the season name
    const season = input.bestSeason.split("(")[0].trim();
    properties["Best Season"] = { select: { name: season } };
  }
  if (input.photos && input.photos.length > 0) properties.Photos = { rich_text: [{ text: { content: JSON.stringify(input.photos) } }] };
  if (input.notes) properties.Notes = { rich_text: [{ text: { content: input.notes } }] };

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties,
  });

  return page.id;
}

export async function updateWishListItem(
  pageId: string,
  updates: Partial<CreateWishListInput> & { _action?: string }
): Promise<void> {
  // Handle archive/restore
  if (updates._action === "archive" || updates._action === "restore") {
    const statusValue = updates._action === "archive" ? "Archived" : "Active";
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: { _Status: { select: { name: statusValue } } },
      });
    } catch {
      // _Status might not exist — ensure it, then retry
      await getOrCreateDatabase(); // triggers schema sync
      await notion.pages.update({
        page_id: pageId,
        properties: { _Status: { select: { name: statusValue } } },
      });
    }
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (updates.project !== undefined) properties.Project = { title: [{ text: { content: updates.project } }] };
  if (updates.description !== undefined) properties.Description = { rich_text: updates.description ? richTextChunks(updates.description) : [] };
  if (updates.aiPlan !== undefined) properties["AI Plan"] = { rich_text: updates.aiPlan ? richTextChunks(updates.aiPlan) : [] };
  if (updates.estimatedCost !== undefined) properties["Estimated Cost"] = { number: updates.estimatedCost ?? null };
  if (updates.valueAdd !== undefined) properties["Value Add"] = { number: updates.valueAdd ?? null };
  if (updates.roi !== undefined) properties.ROI = { number: updates.roi != null ? updates.roi / 100 : null };
  if (updates.roiRating !== undefined) properties["ROI Rating"] = updates.roiRating ? { select: { name: updates.roiRating } } : { select: null };
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
  if (updates.photos !== undefined) properties.Photos = { rich_text: updates.photos.length > 0 ? [{ text: { content: JSON.stringify(updates.photos) } }] : [] };
  if (updates.notes !== undefined) properties.Notes = updates.notes ? { rich_text: [{ text: { content: updates.notes } }] } : { rich_text: [] };

  if (Object.keys(properties).length > 0) {
    await notion.pages.update({ page_id: pageId, properties });
  }
}

export async function deleteWishListItem(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}
