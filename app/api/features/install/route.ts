import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Cache the parent page ID so we only create it once
let featureParentPageId: string | null = null;

async function getOrCreateParentPage(): Promise<string> {
  if (featureParentPageId) return featureParentPageId;

  // Search for existing "TaskTracker Features" page
  const search = await notion.search({
    query: "TaskTracker Features",
    filter: { property: "object", value: "page" },
  });

  for (const result of search.results) {
    if ("properties" in result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titleProp = (result as any).properties?.title;
      if (titleProp?.type === "title") {
        const text = titleProp.title?.map((t: { plain_text: string }) => t.plain_text).join("");
        if (text === "TaskTracker Features") {
          featureParentPageId = result.id;
          return result.id;
        }
      }
    }
  }

  // Create a new page in the workspace to hold feature databases
  const page = await notion.pages.create({
    parent: { workspace: true },
    properties: {
      title: { title: [{ text: { content: "TaskTracker Features" } }] },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  featureParentPageId = page.id;
  return page.id;
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

    // Create database under the "TaskTracker Features" parent page
    const parentId = await getOrCreateParentPage();

    const db = await notion.databases.create({
      parent: { page_id: parentId },
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
