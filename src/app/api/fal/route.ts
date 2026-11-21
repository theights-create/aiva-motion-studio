import { route } from "@fal-ai/server-proxy/nextjs";
import { isAllowedTarget } from "@/lib/studio/proxy-allowlist";
import type { NextRequest } from "next/server";

/**
 * fal client proxy used by the timeline editor (/app). The proxy attaches the
 * server-side FAL_KEY, so it only forwards calls on the allowlist.
 */
async function guarded(req: NextRequest) {
  if (!isAllowedTarget(req.headers.get("x-fal-target-url"))) {
    return new Response("Endpoint not allowed by this app", { status: 403 });
  }
  return route.handler(req);
}

export const GET = guarded;
export const POST = guarded;
export const PUT = guarded;
