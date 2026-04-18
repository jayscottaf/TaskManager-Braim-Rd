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
  notes: string | null;
  _status: string;
}

/** Helper: get the active cost/roi based on costMode */
export function getActiveCost(item: WishListItem): number | null {
  return item.costMode === "Hired Out" ? item.hiredCost : item.diyCost;
}
export function getActiveRoi(item: WishListItem): number | null {
  return item.costMode === "Hired Out" ? item.hiredRoi : item.diyRoi;
}
export function getActiveRoiRating(item: WishListItem): string | null {
  return item.costMode === "Hired Out" ? item.hiredRoiRating : item.diyRoiRating;
}

export interface CreateWishListInput {
  project: string;
  description?: string;
  aiPlan?: string;
  diyCost?: number;
  hiredCost?: number;
  valueAdd?: number;
  diyRoi?: number;
  hiredRoi?: number;
  diyRoiRating?: string;
  hiredRoiRating?: string;
  diyDifficulty?: string;
  costMode?: string;
  category?: string;
  priority?: string;
  timeline?: string;
  bestSeason?: string;
  photos?: string[];
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
          if (key === "Project") continue;
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
  if (updates._action === "archive" || updates._action === "restore") {
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
  if (updates.notes !== undefined) properties.Notes = updates.notes ? { rich_text: [{ text: { content: updates.notes } }] } : { rich_text: [] };

  if (Object.keys(properties).length > 0) {
    await notion.pages.update({ page_id: pageId, properties });
  }
}

export async function deleteWishListItem(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
}
