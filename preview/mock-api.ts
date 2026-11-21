/**
 * Browser stand-in for /api/studio/* so the preview runs without a server or
 * a fal key. It reuses the real registry, validation and cost logic, then
 * simulates the queue and returns a bundled sample clip. Nothing reaches fal.
 */
import { FORMATS, type FormatId, validateRequest } from "@/lib/studio/models";

const SAMPLE_CLIPS: Record<FormatId, string> = {
  vertical: "samples/aiva-sample-vertical.mp4",
  square: "samples/aiva-sample-square.mp4",
  landscape: "samples/aiva-sample-landscape.mp4",
  match: "samples/aiva-sample-landscape.mp4",
};

type SimJob = { createdAt: number; format: FormatId };
const jobs = new Map<string, SimJob>();
const QUEUE_MS = 2500;
const RENDER_MS = 7000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upload(init?: RequestInit) {
  const form = init?.body;
  const file = form instanceof FormData ? form.get("file") : null;
  if (!(file instanceof Blob)) return json({ error: "No file provided" }, 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return json({ error: "Use a JPG, PNG or WebP image" }, 415);
  }
  if (file.size > 10 * 1024 * 1024) {
    return json({ error: "Image must be 10 MB or smaller" }, 413);
  }
  await wait(700);
  return json({ url: URL.createObjectURL(file) });
}

async function generate(init?: RequestInit) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(String(init?.body ?? ""));
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  // The real server only accepts fal.media URLs. The preview keeps the
  // uploaded image in the browser, so validate against a stand-in URL.
  const forValidation =
    typeof body.imageUrl === "string" && body.imageUrl.startsWith("blob:")
      ? { ...body, imageUrl: "https://v3.fal.media/files/preview/ref.png" }
      : body;
  const result = validateRequest(forValidation);
  if (!result.ok) return json({ error: result.error }, 400);
  const approved = Number(body.approvedCostUsd);
  if (!Number.isFinite(approved) || approved + 1e-9 < result.estimate.usd) {
    return json(
      {
        error: `Cost approval required: estimated $${result.estimate.usd.toFixed(2)}`,
      },
      402,
    );
  }
  await wait(400);
  const requestId = `preview-${Math.random().toString(36).slice(2, 12)}`;
  jobs.set(requestId, { createdAt: Date.now(), format: result.params.format });
  return json({
    requestId,
    modelId: result.model.id,
    endpointId: result.model.endpointId,
    estimate: result.estimate,
  });
}

function status(url: URL) {
  const id = url.searchParams.get("requestId") ?? "";
  const job = jobs.get(id);
  if (!job) {
    // After a reload: the simulated queue lives in memory only.
    return json({
      status: "failed",
      error: "This preview job ended when the page reloaded. Generate again.",
      logs: [],
    });
  }
  const t = Date.now() - job.createdAt;
  if (t < QUEUE_MS) {
    return json({
      status: "queued",
      queuePosition: t < QUEUE_MS / 2 ? 1 : 0,
      logs: [],
    });
  }
  if (t < QUEUE_MS + RENDER_MS) {
    const pct = Math.round(((t - QUEUE_MS) / RENDER_MS) * 100);
    return json({
      status: "running",
      logs: [`Preview render ${pct}% · ${FORMATS[job.format].label}`],
    });
  }
  return json({
    status: "completed",
    videoUrl: new URL(SAMPLE_CLIPS[job.format], location.href).toString(),
    logs: ["Sample clip ready"],
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const url = new URL(raw, location.href);
  if (url.pathname.endsWith("/api/studio/upload")) return upload(init);
  if (url.pathname.endsWith("/api/studio/generate")) return generate(init);
  if (url.pathname.endsWith("/api/studio/status")) return status(url);
  return realFetch(input, init);
};
