import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { getTemplate } from "@/lib/feature-templates";
import { findBestDatabase, restoreDatabase, syncDatabaseSchema } from "@/lib/feature-db";

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

    const best = await findBestDatabase(template.name);

    if (!best) {
      return NextResponse.json({ installed: false });
    }

    if (best.archived) {
      await restoreDatabase(best.id);
    }

    // Sync schema — adds any missing columns from template updates
    await syncDatabaseSchema(best.id, template.schema);

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
