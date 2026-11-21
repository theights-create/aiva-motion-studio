import { getModel } from "@/lib/studio/models";
import { falErrorMessage, getFal, jsonError } from "@/lib/studio/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type VideoResult = { video?: { url?: string; content_type?: string } };

/** Poll a queued generation. Returns queue position, logs, and the video URL once done. */
export async function GET(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("modelId") ?? "";
  const requestId = req.nextUrl.searchParams.get("requestId") ?? "";
  const model = getModel(modelId);
  if (!model) return jsonError("Unknown model", 400);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) return jsonError("Invalid request id", 400);

  try {
    const fal = getFal();
    const status = await fal.queue.status(model.endpointId, {
      requestId,
      logs: true,
    });

    const logs =
      "logs" in status && Array.isArray(status.logs)
        ? status.logs.map((l) => l.message).filter(Boolean).slice(-8)
        : [];

    if (status.status === "IN_QUEUE") {
      return Response.json({ status: "queued", queuePosition: status.queue_position, logs });
    }
    if (status.status === "IN_PROGRESS") {
      return Response.json({ status: "running", logs });
    }

    // COMPLETED: fetch the result (throws if the model run failed).
    try {
      const result = await fal.queue.result(model.endpointId, { requestId });
      const url = (result.data as VideoResult)?.video?.url;
      if (!url) return Response.json({ status: "failed", error: "No video returned", logs });
      return Response.json({ status: "completed", videoUrl: url, logs });
    } catch (err) {
      return Response.json({ status: "failed", error: falErrorMessage(err), logs });
    }
  } catch (err) {
    console.error("[studio/status]", err);
    return jsonError(falErrorMessage(err), 502);
  }
}
