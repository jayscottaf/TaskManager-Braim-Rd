import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { featureId } = await request.json();
    const template = getTemplate(featureId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Build Notion properties from template schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};

    // First field becomes the title
    const titleField = template.schema[0];
    properties[titleField.name] = { title: {} };

    // Remaining fields
    for (let i = 1; i < template.schema.length; i++) {
      const field = template.schema[i];
      switch (field.type) {
        case "text":
          properties[field.name] = { rich_text: {} };
          break;
        case "number":
          properties[field.name] = { number: { format: field.name.toLowerCase().includes("price") || field.name.toLowerCase().includes("cost") || field.name.toLowerCase().includes("value") ? "dollar" : "number" } };
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

    // Create the database as a child of the workspace
    // We'll use the same parent page as the main database
    const mainDbId = process.env.NOTION_DATABASE_ID!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainDb = (await notion.databases.retrieve({ database_id: mainDbId })) as any;
    const parentPageId = mainDb.parent?.page_id || mainDb.parent?.workspace;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
      parent: parentPageId
        ? { page_id: parentPageId }
        : { type: "page_id", page_id: mainDbId },
      title: [{ text: { content: `TaskTracker: ${template.name}` } }],
      properties,
    };

    // Try creating with page parent, fall back to creating inline
    let db;
    try {
      db = await notion.databases.create(createParams);
    } catch {
      // If parent fails, try workspace-level
      db = await notion.databases.create({
        parent: { page_id: mainDbId },
        title: [{ text: { content: `TaskTracker: ${template.name}` } }],
        properties,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

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
