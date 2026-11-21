import { AVAILABLE_ENDPOINTS } from "@/lib/fal-endpoints";
import { STUDIO_MODELS } from "@/lib/studio/models";

/**
 * Allowlist for /api/fal. The proxy attaches the server-side FAL_KEY, so it
 * only forwards calls to endpoints this app ships with, plus fal storage
 * uploads. Anything else is refused.
 */
const ALLOWED_ENDPOINTS = [
  ...AVAILABLE_ENDPOINTS.map((e) => e.endpointId),
  ...STUDIO_MODELS.map((m) => m.endpointId),
  "fal-ai/ffmpeg-api/compose",
  "fal-ai/ffmpeg-api/metadata",
  "fal-ai/ffmpeg-api/waveform",
  "fal-ai/any-llm",
];

function appIdOf(endpointId: string) {
  // fal queue status/result URLs use only the owner/app prefix of the endpoint.
  return endpointId.split("/").slice(0, 2).join("/");
}

export function isAllowedTarget(target: string | null): boolean {
  if (!target) return false;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const path = url.pathname.replace(/^\/+/, "");

  if (url.hostname === "rest.alpha.fal.ai") {
    return path.startsWith("storage/upload/");
  }
  if (url.hostname === "fal.run" || url.hostname === "queue.fal.run") {
    return ALLOWED_ENDPOINTS.some((id) => {
      if (path === id || path.startsWith(`${id}/`)) return true;
      // queue status / result / cancel: {owner}/{app}/requests/{id}/...
      return (
        url.hostname === "queue.fal.run" &&
        path.startsWith(`${appIdOf(id)}/requests/`)
      );
    });
  }
  return false;
}
