import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { checkAuth } from "@/lib/auth";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  try {
    const { databaseId } = await request.json();

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId required" }, { status: 400 });
    }

    // Archive the database in Notion (soft delete)
    await notion.databases.update({
      database_id: databaseId,
      archived: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feature uninstall error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to uninstall: ${msg}` },
      { status: 500 }
    );
  }
}
