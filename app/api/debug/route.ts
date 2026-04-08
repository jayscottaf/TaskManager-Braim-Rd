import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return NextResponse.json({
      ok: false,
      error: "Missing env vars",
      hasApiKey: !!apiKey,
      hasDatabaseId: !!databaseId,
    });
  }

  const notion = new Client({ auth: apiKey });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await notion.databases.retrieve({ database_id: databaseId })) as any;
    const title =
      Array.isArray(db.title) && db.title.length > 0 ? db.title[0].plain_text : "(untitled)";
    return NextResponse.json({
      ok: true,
      database: title,
      databaseId: databaseId.slice(0, 8) + "...",
      apiKeyPrefix: apiKey.slice(0, 12) + "...",
    });
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json({
      ok: false,
      error: e.message ?? "Unknown error",
      code: e.code,
      status: e.status,
      databaseId: databaseId.slice(0, 8) + "...",
      apiKeyPrefix: apiKey.slice(0, 12) + "...",
    });
  }
}
