import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Simple shared-secret auth for API routes.
 * Checks the `x-app-secret` header against APP_SECRET using timing-safe comparison.
 * Returns null if authorized, or a 401 Response if not.
 */
export function checkAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.APP_SECRET;
  if (!secret) return null; // No secret configured = auth disabled

  const headerSecret = request.headers.get("x-app-secret");
  if (!headerSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(headerSecret);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return null; // Authorized
    }
  } catch {
    // timingSafeEqual throws if buffers have different lengths in older Node versions
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
