import { validateRequest } from "@/lib/studio/models";
import {
  falErrorMessage,
  getFal,
  jsonError,
  maxClipCostUsd,
} from "@/lib/studio/server";

export const dynamic = "force-dynamic";

/**
 * Submit a paid generation to the fal queue.
 *
 * The browser must echo back the estimate the user approved
 * (`approvedCostUsd`). The server re-computes the estimate from its own
 * registry and refuses if the approval does not cover it, or if it is above
 * MAX_CLIP_COST_USD.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const result = validateRequest(body);
  if (!result.ok) return jsonError(result.error, 400);
  const { model, input, estimate } = result;

  const approved = Number(
    (body as { approvedCostUsd?: unknown }).approvedCostUsd,
  );
  if (!Number.isFinite(approved) || approved + 1e-9 < estimate.usd) {
    return jsonError(
      `Cost approval required: estimated $${estimate.usd.toFixed(2)}`,
      402,
    );
  }
  const cap = maxClipCostUsd();
  if (estimate.usd > cap) {
    return jsonError(
      `Estimated $${estimate.usd.toFixed(2)} is above this studio's $${cap.toFixed(2)} per-clip limit`,
      400,
    );
  }

  try {
    const fal = getFal();
    const { request_id } = await fal.queue.submit(model.endpointId, { input });
    return Response.json({
      requestId: request_id,
      modelId: model.id,
      endpointId: model.endpointId,
      estimate,
    });
  } catch (err) {
    console.error("[studio/generate]", err);
    return jsonError(falErrorMessage(err), 502);
  }
}
