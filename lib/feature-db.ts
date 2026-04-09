import { Client } from "@notionhq/client";
import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { FieldDefinition } from "./feature-templates";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export const FEATURES_PAGE_ID = process.env.NOTION_FEATURES_PAGE_ID || "33d70ce0-a955-81b6-86ff-d14e049a6b9c";

interface CandidateDb {
  id: string;
  archived: boolean;
  createdTime: string;
  entryCount: number;
}

/**
 * Find the best existing Notion database for a feature template.
 * Priority: has entries > non-archived > most recently created.
 * Returns null if no matching database exists.
 */
export async function findBestDatabase(templateName: string): Promise<CandidateDb | null> {
  const children = await notion.blocks.children.list({
    block_id: FEATURES_PAGE_ID,
    page_size: 100,
  });

  const candidates: CandidateDb[] = [];

  for (const block of children.results) {
    if (!("type" in block) || block.type !== "child_database") continue;
    try {
      const db = await notion.databases.retrieve({
        database_id: block.id,
      }) as DatabaseObjectResponse;

      const title = db.title.map((t) => t.plain_text).join("");
      if (title !== templateName) continue;

      // Check how many entries this database has
      const query = await notion.databases.query({
        database_id: block.id,
        page_size: 1, // We only need to know if it has entries
      });

      candidates.push({
        id: db.id,
        archived: db.archived,
        createdTime: db.created_time,
        entryCount: query.results.length,
      });
    } catch {
      continue;
    }
  }

  if (candidates.length === 0) return null;

  // Sort: has entries first, then non-archived, then most recent
  candidates.sort((a, b) => {
    // Prefer databases with entries
    const aHasData = a.entryCount > 0 ? 1 : 0;
    const bHasData = b.entryCount > 0 ? 1 : 0;
    if (bHasData !== aHasData) return bHasData - aHasData;

    // Prefer non-archived
    const aActive = a.archived ? 0 : 1;
    const bActive = b.archived ? 0 : 1;
    if (bActive !== aActive) return bActive - aActive;

    // Most recent
    return b.createdTime.localeCompare(a.createdTime);
  });

  return candidates[0];
}

/**
 * Restore an archived database.
 */
export async function restoreDatabase(databaseId: string): Promise<void> {
  await notion.databases.update({
    database_id: databaseId,
    archived: false,
  });
}

/**
 * Build the Notion property definition for a schema field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldToNotionProperty(field: FieldDefinition): Record<string, any> {
  switch (field.type) {
    case "text":
    case "textarea":
      return { rich_text: {} };
    case "number":
      return {
        number: {
          format: field.name.toLowerCase().includes("price") ||
            field.name.toLowerCase().includes("cost") ||
            field.name.toLowerCase().includes("value")
            ? "dollar" : "number",
        },
      };
    case "select":
      return { select: { options: (field.options || []).map((o) => ({ name: o })) } };
    case "date":
      return { date: {} };
    case "url":
      return { url: {} };
    default:
      return { rich_text: {} };
  }
}

/**
 * Sync a database's properties with the template schema.
 * Adds any missing columns (from schema updates) without touching existing data.
 */
export async function syncDatabaseSchema(
  databaseId: string,
  schema: FieldDefinition[]
): Promise<void> {
  const db = await notion.databases.retrieve({
    database_id: databaseId,
  }) as DatabaseObjectResponse;

  const existingProps = new Set(Object.keys(db.properties));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missingProps: Record<string, any> = {};

  // Check schema fields (skip first — it's always the title, which always exists)
  for (let i = 1; i < schema.length; i++) {
    const field = schema[i];
    if (!existingProps.has(field.name)) {
      missingProps[field.name] = fieldToNotionProperty(field);
    }
  }

  // Check internal _Status field
  if (!existingProps.has("_Status")) {
    missingProps["_Status"] = {
      select: { options: [{ name: "Active" }, { name: "Archived" }] },
    };
  }

  // Only call update if there are missing properties
  if (Object.keys(missingProps).length > 0) {
    await notion.databases.update({
      database_id: databaseId,
      properties: missingProps,
    });
  }
}
