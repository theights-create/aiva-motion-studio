import { describe, expect, it } from "vitest";
import {
  STUDIO_MODELS,
  estimateCost,
  getModel,
  isFalMediaUrl,
  supportedFormats,
  validateRequest,
} from "@/lib/studio/models";

const IMG = "https://v3.fal.media/files/abc/ref.png";

describe("model registry", () => {
  it("offers text-to-video and image-to-video models", () => {
    expect(
      STUDIO_MODELS.filter((m) => m.mode === "text-to-video"),
    ).toHaveLength(4);
    expect(
      STUDIO_MODELS.filter((m) => m.mode === "image-to-video"),
    ).toHaveLength(4);
  });

  it("exposes vertical/square/landscape wherever the endpoint supports them", () => {
    expect(supportedFormats(getModel("seedance-2-t2v")!)).toEqual([
      "vertical",
      "square",
      "landscape",
    ]);
    expect(supportedFormats(getModel("kling-v3-pro-t2v")!)).toEqual([
      "vertical",
      "square",
      "landscape",
    ]);
    // Veo 3.1 Lite schema has only 16:9 and 9:16
    expect(supportedFormats(getModel("veo-3-1-lite-t2v")!)).toEqual([
      "vertical",
      "landscape",
    ]);
    // Kling V3 I2V has no aspect_ratio input: follows the image
    expect(supportedFormats(getModel("kling-v3-pro-i2v")!)).toEqual(["match"]);
    expect(supportedFormats(getModel("seedance-2-i2v")!)).toEqual([
      "vertical",
      "square",
      "landscape",
      "match",
    ]);
  });

  it("builds inputs with the exact field names from each schema", () => {
    expect(
      getModel("seedance-2-t2v")!.buildInput({
        prompt: "p",
        format: "vertical",
        duration: 5,
        resolution: "720p",
      }),
    ).toEqual({
      prompt: "p",
      aspect_ratio: "9:16",
      duration: "5",
      resolution: "720p",
      generate_audio: true,
    });
    expect(
      getModel("veo-3-1-lite-t2v")!.buildInput({
        prompt: "p",
        format: "landscape",
        duration: 6,
        resolution: "1080p",
      }),
    ).toMatchObject({
      aspect_ratio: "16:9",
      duration: "6s",
      resolution: "1080p",
    });
    expect(
      getModel("kling-v3-pro-i2v")!.buildInput({
        prompt: "p",
        imageUrl: IMG,
        format: "match",
        duration: 5,
        resolution: null,
      }),
    ).toEqual({
      prompt: "p",
      start_image_url: IMG,
      duration: "5",
      generate_audio: true,
    });
    expect(
      getModel("seedance-2-fast-i2v")!.buildInput({
        prompt: "p",
        imageUrl: IMG,
        format: "match",
        duration: 4,
        resolution: "480p",
      }),
    ).toMatchObject({ image_url: IMG, aspect_ratio: "auto" });
  });
});

describe("cost estimates", () => {
  it("per-second models multiply list price by duration", () => {
    expect(estimateCost(getModel("kling-v3-pro-t2v")!, 5, null).usd).toBe(0.7);
    expect(estimateCost(getModel("veo-3-1-lite-t2v")!, 8, "720p").usd).toBe(
      0.4,
    );
  });
  it("Seedance uses the token formula and is flagged approximate", () => {
    const e = estimateCost(getModel("seedance-2-t2v")!, 5, "720p");
    // 1280*720*24*5/1024 = 108,000 tokens * $0.014/1k
    expect(e.usd).toBe(1.51);
    expect(e.approximate).toBe(true);
    expect(estimateCost(getModel("seedance-2-fast-t2v")!, 5, "480p").usd).toBe(
      0.56,
    );
  });
});

describe("validateRequest", () => {
  const base = {
    modelId: "kling-v3-pro-t2v",
    prompt: "a city",
    format: "square",
    duration: 5,
  };
  it("accepts a valid request", () => {
    const r = validateRequest(base);
    expect(r.ok).toBe(true);
  });
  it("rejects unknown models, empty prompts, unsupported formats/durations", () => {
    expect(validateRequest({ ...base, modelId: "fal-ai/anything" }).ok).toBe(
      false,
    );
    expect(validateRequest({ ...base, prompt: "  " }).ok).toBe(false);
    expect(
      validateRequest({
        ...base,
        modelId: "veo-3-1-lite-t2v",
        resolution: "720p",
        duration: 4,
      }).ok,
    ).toBe(false); // square
    expect(validateRequest({ ...base, duration: 60 }).ok).toBe(false);
    expect(
      validateRequest({
        ...base,
        modelId: "seedance-2-fast-t2v",
        format: "vertical",
        resolution: "1080p",
      }).ok,
    ).toBe(false);
  });
  it("requires a fal-hosted image for image-to-video", () => {
    const i2v = {
      modelId: "seedance-2-i2v",
      prompt: "move",
      format: "match",
      duration: 5,
      resolution: "720p",
    };
    expect(validateRequest(i2v).ok).toBe(false);
    expect(
      validateRequest({ ...i2v, imageUrl: "https://evil.example.com/x.png" })
        .ok,
    ).toBe(false);
    expect(validateRequest({ ...i2v, imageUrl: IMG }).ok).toBe(true);
  });
  it("isFalMediaUrl only matches fal.media over https", () => {
    expect(isFalMediaUrl("https://fal.media/files/x.mp4")).toBe(true);
    expect(isFalMediaUrl("https://v3.fal.media/files/x.mp4")).toBe(true);
    expect(isFalMediaUrl("http://v3.fal.media/x")).toBe(false);
    expect(isFalMediaUrl("https://fal.media.evil.com/x")).toBe(false);
    expect(isFalMediaUrl("http://169.254.169.254/")).toBe(false);
  });
});
