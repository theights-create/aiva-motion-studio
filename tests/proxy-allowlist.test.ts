import { describe, expect, it } from "vitest";
import { isAllowedTarget } from "@/lib/studio/proxy-allowlist";

describe("/api/fal allowlist", () => {
  it("allows endpoints the app ships with", () => {
    expect(isAllowedTarget("https://queue.fal.run/fal-ai/flux/dev")).toBe(true);
    expect(
      isAllowedTarget(
        "https://queue.fal.run/bytedance/seedance-2.0/text-to-video",
      ),
    ).toBe(true);
    expect(
      isAllowedTarget(
        "https://queue.fal.run/fal-ai/minimax/video-01-live/image-to-video",
      ),
    ).toBe(true);
    expect(
      isAllowedTarget("https://queue.fal.run/fal-ai/flux/requests/abc/status"),
    ).toBe(true);
    expect(
      isAllowedTarget(
        "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      ),
    ).toBe(true);
  });
  it("refuses everything else", () => {
    expect(isAllowedTarget(null)).toBe(false);
    expect(
      isAllowedTarget("https://queue.fal.run/fal-ai/some-expensive-model"),
    ).toBe(false);
    expect(isAllowedTarget("https://queue.fal.run/fal-ai/flux-pro-evil")).toBe(
      false,
    );
    expect(isAllowedTarget("https://rest.alpha.fal.ai/billing/whatever")).toBe(
      false,
    );
    expect(isAllowedTarget("https://example.com/fal-ai/flux/dev")).toBe(false);
    expect(isAllowedTarget("http://queue.fal.run/fal-ai/flux/dev")).toBe(false);
  });
});
