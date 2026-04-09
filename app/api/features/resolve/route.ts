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

    // Find the best database: prefer non-archived, then most recent
    let best: { id: string; archived: boolean; createdTime: string } | null = null;

    for (const block of children.results) {
      if (!("type" in block) || block.type !== "child_database") continue;
      try {
        const db = await notion.databases.retrieve({
          database_id: block.id,
        }) as DatabaseObjectResponse;

        const title = db.title.map((t) => t.plain_text).join("");
        if (title !== template.name) continue;

        if (!best ||
            (!db.archived && best.archived) ||
            (db.archived === best.archived && db.created_time > best.createdTime)) {
          best = { id: db.id, archived: db.archived, createdTime: db.created_time };
        }
      } catch {
        continue;
      }
    }

    if (!best) {
      return NextResponse.json({ installed: false });
    }

    // Restore if archived
    if (best.archived) {
      await notion.databases.update({
        database_id: best.id,
        archived: false,
      });
    }

    return NextResponse.json({
      installed: true,
      databaseId: best.id,
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
