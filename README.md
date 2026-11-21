# AIVA Motion Studio

AIVA System's AI video studio. Describe a scene or upload a reference image,
pick a format, approve the estimated cost, then follow the render and preview
and download the clip. Built on the
[fal AI Video Starter Kit](https://github.com/fal-ai-community/video-starter-kit)
(Next.js 14, fal.ai, Remotion).

## What's inside

| Route | Purpose |
|---|---|
| `/` | **Motion Studio**: text-to-video and image-to-video |
| `/app` | The starter kit's multi-track timeline editor |

### Models

These were chosen with the `fal-models-catalog` skill and checked against the
live fal catalog with `genmedia` (status, input schema, pricing):

| Model | Text to video | Image to video | Formats | List price |
|---|---|---|---|---|
| Seedance 2.0 (premium) | `bytedance/seedance-2.0/text-to-video` | `…/image-to-video` | 9:16 · 1:1 · 16:9 (+ match image) | $0.014 / 1k tokens |
| Seedance 2.0 Fast | `bytedance/seedance-2.0/fast/text-to-video` | `…/image-to-video` | 9:16 · 1:1 · 16:9 (+ match image) | $0.0112 / 1k tokens |
| Kling V3 Pro | `fal-ai/kling-video/v3/pro/text-to-video` | `…/image-to-video` | T2V 9:16 · 1:1 · 16:9; I2V follows image | $0.14 / s |
| Veo 3.1 Lite | `fal-ai/veo3.1/lite` | `fal-ai/veo3.1/lite/image-to-video` | 9:16 · 16:9 (+ match image) | $0.05 / s |

The UI only offers a format, duration or resolution when that endpoint's schema
supports it. Seedance is billed in tokens, so its estimate uses
`width × height × 24fps × seconds ÷ 1024` and is marked "≈".

All model definitions live in `src/lib/studio/models.ts`.

### Security

- `FAL_KEY` is read only on the server (`src/lib/studio/server.ts`). The
  starter kit's browser key dialog has been removed.
- The studio calls only its own routes: `/api/studio/upload`, `/generate` and
  `/status`. `/generate` validates every option against the registry,
  re-computes the cost, requires the client to send the approved amount, and
  refuses anything over `MAX_CLIP_COST_USD`.
- `/api/fal` (used by the timeline editor) forwards only to an allowlist of
  endpoints the app ships with (`src/lib/studio/proxy-allowlist.ts`).
- `/api/download` fetches only `fal.media` URLs, so it can't be used as an open proxy.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set FAL_KEY
npm run dev                  # http://localhost:3000
```

## Test

```bash
npm test            # unit tests: registry, cost math, validation, approval gate, allowlist
npm run typecheck
npm run build
```

## Agent skills

`.claude/skills/` contains the fal `fal-models-catalog` and `genmedia` skills,
installed with the
[fal skills installer](https://github.com/fal-ai-community/skills/blob/main/docs/install.md).
They use the [genmedia CLI](https://github.com/fal-ai-community/genmedia-cli)
for model discovery, schemas and pricing.

## License

MIT. The original starter kit is © fal.ai, see [LICENSE](LICENSE).
