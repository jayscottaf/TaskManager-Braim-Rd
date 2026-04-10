import { NextRequest, NextResponse } from "next/server";

/**
 * Simple shared-secret auth for API routes.
 * Checks the `x-app-secret` header or `secret` query param against APP_SECRET.
 * Returns null if authorized, or a 401 Response if not.
 */
export function checkAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.APP_SECRET;
  if (!secret) return null; // No secret configured = auth disabled

  const headerSecret = request.headers.get("x-app-secret");

  if (headerSecret === secret) {
    return null; // Authorized
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
