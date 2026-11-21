import { isFalMediaUrl } from "@/lib/studio/models";
import { NextRequest } from "next/server";

/**
 * Download a generated file as an attachment.
 * Only fal CDN URLs are fetched, so this cannot be used as an open proxy.
 */
export const GET = async (req: NextRequest) => {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing 'url' query parameter", { status: 400 });
  }
  if (!isFalMediaUrl(url)) {
    return new Response("Only fal.media URLs can be downloaded", { status: 400 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new Response("Could not fetch file", { status: 502 });
  }

  const rawName = req.nextUrl.searchParams.get("filename") ?? "";
  const filename =
    rawName.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80) ||
    new URL(url).pathname.split("/").pop() ||
    "aiva-clip.mp4";

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/octet-stream",
  );
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  return new Response(upstream.body, { headers });
};
