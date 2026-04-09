import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";
import { findBestDatabase, restoreDatabase, FEATURES_PAGE_ID } from "@/lib/feature-db";

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

    // First, check if a database already exists (prefer ones with data)
    const existing = await findBestDatabase(template.name);

    if (existing) {
      if (existing.archived) {
        await restoreDatabase(existing.id);
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

    // Internal status field for archive support (not shown in forms)
    properties["_Status"] = {
      select: { options: [{ name: "Active" }, { name: "Archived" }] },
    };

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
