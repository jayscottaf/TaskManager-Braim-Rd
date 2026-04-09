import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

  // Uninstall only removes the feature from the client.
  // The Notion database is never archived — data is always preserved.
  // The client calls removeInstalledFeature() to clear localStorage.
  return NextResponse.json({ success: true });
}
