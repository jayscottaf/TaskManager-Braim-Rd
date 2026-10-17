export class RequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: unknown) {
    super(message);
    this.name = "RequestError";
  }
}

/** A failed HTTP response must never be treated as a successful mutation. */
export async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage = typeof body?.error === "string" ? body.error : null;
    throw new RequestError(serverMessage || `The request failed (${response.status}). Please try again.`, response.status, body);
  }
  return body as T;
}

export function taskRequestHeaders(): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
  return { "Content-Type": "application/json", ...(secret ? { "x-app-secret": secret } : {}) };
}

/** Accept local destinations only, including their filters and calendar state. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://taskmaster.invalid");
    if (url.origin !== "https://taskmaster.invalid" || url.pathname.startsWith("/api/")) return null;
    // Returning to an editor can create a navigation loop after saving/deleting.
    if (url.pathname === "/add" || url.pathname.startsWith("/task/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
