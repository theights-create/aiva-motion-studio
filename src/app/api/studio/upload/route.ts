import { falErrorMessage, getFal, jsonError } from "@/lib/studio/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Upload a reference image to fal storage with the server key. Returns a fal.media URL. */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return jsonError("No file provided", 400);
  if (!ALLOWED_TYPES.includes(file.type)) {
    return jsonError("Use a JPG, PNG or WebP image", 415);
  }
  if (file.size > MAX_BYTES) return jsonError("Image must be 10 MB or smaller", 413);

  try {
    const fal = getFal();
    const url = await fal.storage.upload(file);
    return Response.json({ url });
  } catch (err) {
    console.error("[studio/upload]", err);
    return jsonError(falErrorMessage(err), 502);
  }
}
