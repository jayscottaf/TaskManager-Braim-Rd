import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";
import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const FEATURES_PAGE_ID = process.env.NOTION_FEATURES_PAGE_ID || "33d70ce0-a955-81b6-86ff-d14e049a6b9c";

async function findExistingDatabase(templateName: string): Promise<{ id: string; archived: boolean } | null> {
  const children = await notion.blocks.children.list({
    block_id: FEATURES_PAGE_ID,
    page_size: 100,
  });

  let best: { id: string; archived: boolean; createdTime: string } | null = null;

  for (const block of children.results) {
    if (!("type" in block) || block.type !== "child_database") continue;
    try {
      const db = await notion.databases.retrieve({
        database_id: block.id,
      }) as DatabaseObjectResponse;

      const title = db.title.map((t) => t.plain_text).join("");
      if (title !== templateName) continue;

      // Prefer non-archived, then most recent
      if (!best ||
          (!db.archived && best.archived) ||
          (db.archived === best.archived && db.created_time > best.createdTime)) {
        best = { id: db.id, archived: db.archived, createdTime: db.created_time };
      }
    } catch {
      continue;
    }
  }

  return best ? { id: best.id, archived: best.archived } : null;
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { featureId } = await request.json();
    const template = getTemplate(featureId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // First, check if a database already exists for this feature
    const existing = await findExistingDatabase(template.name);

    if (existing) {
      // Restore if archived
      if (existing.archived) {
        await notion.databases.update({
          database_id: existing.id,
          archived: false,
        });
      }

      return NextResponse.json({
        databaseId: existing.id,
        featureId: template.id,
        name: template.name,
      });
    }

    // No existing database found — create a new one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};

    const titleField = template.schema[0];
    properties[titleField.name] = { title: {} };

    for (let i = 1; i < template.schema.length; i++) {
      const field = template.schema[i];
      switch (field.type) {
        case "text":
        case "textarea":
          properties[field.name] = { rich_text: {} };
          break;
        case "number":
          properties[field.name] = {
            number: {
              format: field.name.toLowerCase().includes("price") ||
                field.name.toLowerCase().includes("cost") ||
                field.name.toLowerCase().includes("value")
                ? "dollar" : "number",
            },
          };
          break;
        case "select":
          properties[field.name] = {
            select: {
              options: (field.options || []).map((o) => ({ name: o })),
            },
          };
          break;
        case "date":
          properties[field.name] = { date: {} };
          break;
        case "url":
          properties[field.name] = { url: {} };
          break;
      }
    }

    const db = await notion.databases.create({
      parent: { page_id: FEATURES_PAGE_ID },
      title: [{ text: { content: template.name } }],
      properties,
    });

    return NextResponse.json({
      databaseId: db.id,
      featureId: template.id,
      name: template.name,
    });
  } catch (error) {
    console.error("Feature install error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to install feature: ${msg}` },
      { status: 500 }
    );
  }
}
