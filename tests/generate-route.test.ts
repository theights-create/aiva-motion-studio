import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const submit = vi.fn(async () => ({ request_id: "req-1234567890" }));
vi.mock("@fal-ai/client", () => ({
  createFalClient: () => ({ queue: { submit } }),
}));

import { POST } from "@/app/api/studio/generate/route";

function call(body: unknown) {
  return POST(
    new Request("http://x/api/studio/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

const valid = {
  modelId: "kling-v3-pro-t2v",
  prompt: "a city",
  format: "vertical",
  duration: 5,
};

describe("POST /api/studio/generate", () => {
  beforeEach(() => {
    submit.mockClear();
    process.env.FAL_KEY = "test-key";
    delete process.env.MAX_CLIP_COST_USD;
  });

  it("refuses without an approval that covers the estimate (no fal call)", async () => {
    const r1 = await call(valid);
    expect(r1.status).toBe(402);
    const r2 = await call({ ...valid, approvedCostUsd: 0.5 });
    expect(r2.status).toBe(402);
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits the validated input when approved", async () => {
    const res = await call({ ...valid, approvedCostUsd: 0.7 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      requestId: "req-1234567890",
      estimate: { usd: 0.7 },
    });
    expect(submit).toHaveBeenCalledWith(
      "fal-ai/kling-video/v3/pro/text-to-video",
      {
        input: {
          prompt: "a city",
          aspect_ratio: "9:16",
          duration: "5",
          generate_audio: true,
        },
      },
    );
  });

  it("enforces the per-clip cost ceiling", async () => {
    process.env.MAX_CLIP_COST_USD = "1";
    const res = await call({ ...valid, duration: 15, approvedCostUsd: 99 });
    expect(res.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects invalid requests before calling fal", async () => {
    const res = await call({
      ...valid,
      modelId: "fal-ai/flux/dev",
      approvedCostUsd: 99,
    });
    expect(res.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
});
