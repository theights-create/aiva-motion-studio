import "server-only";
import { createFalClient } from "@fal-ai/client";

/**
 * Server-side fal client. FAL_KEY is read from the server environment only and
 * never sent to the browser (no NEXT_PUBLIC_ prefix, no client import).
 */
export function getFal() {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new MissingKeyError();
  }
  return createFalClient({ credentials: key });
}

export class MissingKeyError extends Error {
  constructor() {
    super("FAL_KEY is not configured on the server. Add it to .env.local.");
  }
}

/** Hard ceiling per clip, in USD. Requests estimated above this are refused. */
export function maxClipCostUsd(): number {
  const v = Number(process.env.MAX_CLIP_COST_USD);
  return Number.isFinite(v) && v > 0 ? v : 5;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function falErrorMessage(err: unknown): string {
  if (err instanceof MissingKeyError) return err.message;
  const e = err as { status?: number; body?: { detail?: unknown }; message?: string };
  const detail = e?.body?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string }) => d?.msg)
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "string") return detail;
  return e?.message || "Generation service error";
}
