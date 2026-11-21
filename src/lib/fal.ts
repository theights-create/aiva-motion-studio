"use client";

import { createFalClient } from "@fal-ai/client";

// All calls go through /api/fal, which attaches the server-side FAL_KEY.
// No key is ever read or stored in the browser.
export const fal = createFalClient({
  proxyUrl: "/api/fal",
});

export {
  AVAILABLE_ENDPOINTS,
  type ApiInfo,
  type InputAsset,
} from "./fal-endpoints";
