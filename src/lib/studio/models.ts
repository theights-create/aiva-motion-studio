/**
 * AIVA Motion Studio model registry.
 *
 * Endpoints were chosen with the fal-models-catalog skill (text-to-video and
 * image-to-video references) and verified with genmedia against the live fal
 * catalog: `genmedia models --endpoint_id`, `genmedia schema`, `genmedia pricing`.
 * Every option exposed here exists in that endpoint's input schema.
 *
 * This file is shared by the browser (to render options and the estimate) and
 * the server (to validate requests and re-compute the estimate before submit).
 */

export type StudioMode = "text-to-video" | "image-to-video";

/** UI format id. "match" = keep the reference image's own framing. */
export type FormatId = "vertical" | "square" | "landscape" | "match";

export const FORMATS: Record<
  FormatId,
  { label: string; ratio: string; hint: string; w: number; h: number }
> = {
  vertical: { label: "Vertical", ratio: "9:16", hint: "Reels · TikTok · Shorts", w: 9, h: 16 },
  square: { label: "Square", ratio: "1:1", hint: "Feed · Ads", w: 1, h: 1 },
  landscape: { label: "Landscape", ratio: "16:9", hint: "YouTube · Web · TV", w: 16, h: 9 },
  match: { label: "Match image", ratio: "auto", hint: "Keeps your image framing", w: 4, h: 3 },
};

export type Resolution = "480p" | "720p" | "1080p";

export type Pricing =
  | { kind: "per_second"; usdPerSecond: number }
  | { kind: "per_1k_tokens"; usdPer1kTokens: number; fps: number };

export type StudioModel = {
  id: string;
  endpointId: string;
  mode: StudioMode;
  family: string;
  label: string;
  tagline: string;
  tier: "premium" | "fast";
  /** format id -> value sent to the endpoint's aspect field (null = omit field) */
  formats: Partial<Record<FormatId, string | null>>;
  durations: number[];
  defaultDuration: number;
  resolutions: Resolution[] | null;
  defaultResolution: Resolution | null;
  pricing: Pricing;
  /** true when the estimate depends on a formula rather than a flat unit */
  estimateIsApproximate: boolean;
  buildInput: (p: GenerationParams) => Record<string, unknown>;
};

export type GenerationParams = {
  prompt: string;
  imageUrl?: string;
  format: FormatId;
  duration: number;
  resolution: Resolution | null;
};

/** Approximate pixel area of a Seedance frame at each resolution (16:9 basis). */
const SEEDANCE_AREA: Record<Resolution, number> = {
  "480p": 864 * 496,
  "720p": 1280 * 720,
  "1080p": 1920 * 1080,
};

const ASPECT_ALL = { vertical: "9:16", square: "1:1", landscape: "16:9" } as const;

function seedance(
  mode: StudioMode,
  fast: boolean,
): StudioModel {
  const base = fast ? "bytedance/seedance-2.0/fast" : "bytedance/seedance-2.0";
  return {
    id: `seedance-2${fast ? "-fast" : ""}-${mode === "text-to-video" ? "t2v" : "i2v"}`,
    endpointId: `${base}/${mode}`,
    mode,
    family: "ByteDance",
    label: fast ? "Seedance 2.0 Fast" : "Seedance 2.0",
    tagline: fast
      ? "Fast, economical drafts with native audio"
      : "Premium realism and motion with native audio",
    tier: fast ? "fast" : "premium",
    formats:
      mode === "image-to-video"
        ? { ...ASPECT_ALL, match: "auto" }
        : { ...ASPECT_ALL },
    durations: [4, 5, 6, 7, 8, 9, 10, 12, 15],
    defaultDuration: 5,
    resolutions: fast ? ["480p", "720p"] : ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    pricing: {
      kind: "per_1k_tokens",
      usdPer1kTokens: fast ? 0.0112 : 0.014,
      fps: 24,
    },
    estimateIsApproximate: true,
    buildInput: (p) => ({
      prompt: p.prompt,
      ...(mode === "image-to-video" ? { image_url: p.imageUrl } : {}),
      aspect_ratio: (mode === "image-to-video"
        ? { ...ASPECT_ALL, match: "auto" }
        : ASPECT_ALL)[p.format as "vertical"],
      duration: String(p.duration),
      resolution: p.resolution,
      generate_audio: true,
    }),
  };
}

export const STUDIO_MODELS: StudioModel[] = [
  // ---------- Text to video ----------
  seedance("text-to-video", false),
  seedance("text-to-video", true),
  {
    id: "kling-v3-pro-t2v",
    endpointId: "fal-ai/kling-video/v3/pro/text-to-video",
    mode: "text-to-video",
    family: "Kling",
    label: "Kling V3 Pro",
    tagline: "Cinematic camera work, strong prompt adherence",
    tier: "premium",
    formats: { ...ASPECT_ALL },
    durations: [3, 5, 8, 10, 15],
    defaultDuration: 5,
    resolutions: null,
    defaultResolution: null,
    pricing: { kind: "per_second", usdPerSecond: 0.14 },
    estimateIsApproximate: false,
    buildInput: (p) => ({
      prompt: p.prompt,
      aspect_ratio: ASPECT_ALL[p.format as "vertical"],
      duration: String(p.duration),
      generate_audio: true,
    }),
  },
  {
    id: "veo-3-1-lite-t2v",
    endpointId: "fal-ai/veo3.1/lite",
    mode: "text-to-video",
    family: "Google",
    label: "Veo 3.1 Lite",
    tagline: "Lowest cost per second, with audio",
    tier: "fast",
    formats: { vertical: "9:16", landscape: "16:9" },
    durations: [4, 6, 8],
    defaultDuration: 4,
    resolutions: ["720p", "1080p"],
    defaultResolution: "720p",
    pricing: { kind: "per_second", usdPerSecond: 0.05 },
    estimateIsApproximate: false,
    buildInput: (p) => ({
      prompt: p.prompt,
      aspect_ratio: p.format === "vertical" ? "9:16" : "16:9",
      duration: `${p.duration}s`,
      resolution: p.resolution,
      generate_audio: true,
    }),
  },

  // ---------- Image to video ----------
  seedance("image-to-video", false),
  seedance("image-to-video", true),
  {
    id: "kling-v3-pro-i2v",
    endpointId: "fal-ai/kling-video/v3/pro/image-to-video",
    mode: "image-to-video",
    family: "Kling",
    label: "Kling V3 Pro",
    tagline: "Faithful to your reference frame",
    tier: "premium",
    // No aspect_ratio input: output follows the start image.
    formats: { match: null },
    durations: [3, 5, 8, 10, 15],
    defaultDuration: 5,
    resolutions: null,
    defaultResolution: null,
    pricing: { kind: "per_second", usdPerSecond: 0.14 },
    estimateIsApproximate: false,
    buildInput: (p) => ({
      prompt: p.prompt,
      start_image_url: p.imageUrl,
      duration: String(p.duration),
      generate_audio: true,
    }),
  },
  {
    id: "veo-3-1-lite-i2v",
    endpointId: "fal-ai/veo3.1/lite/image-to-video",
    mode: "image-to-video",
    family: "Google",
    label: "Veo 3.1 Lite",
    tagline: "Lowest cost per second, with audio",
    tier: "fast",
    formats: { match: "auto", vertical: "9:16", landscape: "16:9" },
    durations: [4, 6, 8],
    defaultDuration: 4,
    resolutions: ["720p", "1080p"],
    defaultResolution: "720p",
    pricing: { kind: "per_second", usdPerSecond: 0.05 },
    estimateIsApproximate: false,
    buildInput: (p) => ({
      prompt: p.prompt,
      image_url: p.imageUrl,
      aspect_ratio:
        p.format === "vertical" ? "9:16" : p.format === "landscape" ? "16:9" : "auto",
      duration: `${p.duration}s`,
      resolution: p.resolution,
      generate_audio: true,
    }),
  },
];

export function getModel(id: string): StudioModel | undefined {
  return STUDIO_MODELS.find((m) => m.id === id);
}

export function modelsForMode(mode: StudioMode): StudioModel[] {
  return STUDIO_MODELS.filter((m) => m.mode === mode);
}

export function supportedFormats(model: StudioModel): FormatId[] {
  const order: FormatId[] = ["vertical", "square", "landscape", "match"];
  return order.filter((f) => f in model.formats);
}

export type CostEstimate = {
  usd: number;
  breakdown: string;
  approximate: boolean;
};

export function estimateCost(
  model: StudioModel,
  duration: number,
  resolution: Resolution | null,
): CostEstimate {
  const p = model.pricing;
  if (p.kind === "per_second") {
    const usd = round2(p.usdPerSecond * duration);
    return {
      usd,
      breakdown: `${duration}s × $${p.usdPerSecond.toFixed(2)}/s`,
      approximate: model.estimateIsApproximate,
    };
  }
  const area = SEEDANCE_AREA[resolution ?? "720p"];
  const tokens = (area * p.fps * duration) / 1024;
  const usd = round2((tokens / 1000) * p.usdPer1kTokens);
  return {
    usd,
    breakdown: `≈${Math.round(tokens / 1000)}k tokens × $${p.usdPer1kTokens}/1k`,
    approximate: true,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type ValidationResult =
  | { ok: true; model: StudioModel; params: GenerationParams; input: Record<string, unknown>; estimate: CostEstimate }
  | { ok: false; error: string };

export const MAX_PROMPT_LENGTH = 2000;

/** Validate a request against the registry. Used by the server before any paid call. */
export function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const model = typeof b.modelId === "string" ? getModel(b.modelId) : undefined;
  if (!model) return { ok: false, error: "Unknown model" };

  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt) return { ok: false, error: "Describe the scene first" };
  if (prompt.length > MAX_PROMPT_LENGTH) return { ok: false, error: "Prompt is too long" };

  const format = b.format as FormatId;
  if (!supportedFormats(model).includes(format)) {
    return { ok: false, error: `${model.label} does not support that format` };
  }
  const duration = Number(b.duration);
  if (!model.durations.includes(duration)) {
    return { ok: false, error: `${model.label} does not support ${b.duration}s` };
  }
  let resolution: Resolution | null = null;
  if (model.resolutions) {
    resolution = b.resolution as Resolution;
    if (!model.resolutions.includes(resolution)) {
      return { ok: false, error: `${model.label} does not support that resolution` };
    }
  }

  let imageUrl: string | undefined;
  if (model.mode === "image-to-video") {
    if (typeof b.imageUrl !== "string" || !isFalMediaUrl(b.imageUrl)) {
      return { ok: false, error: "Upload a reference image first" };
    }
    imageUrl = b.imageUrl;
  }

  const params: GenerationParams = { prompt, imageUrl, format, duration, resolution };
  return {
    ok: true,
    model,
    params,
    input: model.buildInput(params),
    estimate: estimateCost(model, duration, resolution),
  };
}

/** Only accept media that lives on fal's CDN (uploaded through our server route). */
export function isFalMediaUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      (u.hostname === "fal.media" || u.hostname.endsWith(".fal.media"))
    );
  } catch {
    return false;
  }
}
