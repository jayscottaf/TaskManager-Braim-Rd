import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";
import type { DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const FEATURES_PAGE_ID = process.env.NOTION_FEATURES_PAGE_ID || "33d70ce0-a955-81b6-86ff-d14e049a6b9c";

export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const featureId = request.nextUrl.searchParams.get("featureId");
    if (!featureId) {
      return NextResponse.json({ error: "featureId required" }, { status: 400 });
    }

    const template = getTemplate(featureId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // List all child blocks of the features parent page to find databases
    const children = await notion.blocks.children.list({
      block_id: FEATURES_PAGE_ID,
      page_size: 100,
    });

    // Find the most recently created, non-archived database matching this template name
    let bestDb: { id: string; createdTime: string } | null = null;

    for (const block of children.results) {
      if (!("type" in block) || block.type !== "child_database") continue;
      {
        // Fetch the full database to check if archived and get title
        try {
          const db = await notion.databases.retrieve({
            database_id: block.id,
          }) as DatabaseObjectResponse;

          if (db.archived) continue;

          const title = db.title.map((t) => t.plain_text).join("");
          if (title === template.name) {
            if (!bestDb || db.created_time > bestDb.createdTime) {
              bestDb = { id: db.id, createdTime: db.created_time };
            }
          }
        } catch {
          // Skip databases we can't access
          continue;
        }
      }
    }

    if (!bestDb) {
      return NextResponse.json({ installed: false });
    }

    return NextResponse.json({
      installed: true,
      databaseId: bestDb.id,
      featureId: template.id,
      name: template.name,
    });
  } catch (error) {
    console.error("Feature resolve error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to resolve feature: ${msg}` },
      { status: 500 }
    );
  }
}
