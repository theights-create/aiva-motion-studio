"use client";

import { Logo } from "@/components/logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FORMATS,
  type FormatId,
  MAX_PROMPT_LENGTH,
  type Resolution,
  type StudioMode,
  type StudioModel,
  estimateCost,
  getModel,
  modelsForMode,
  supportedFormats,
} from "@/lib/studio/models";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FilmIcon,
  ImageIcon,
  ImagePlusIcon,
  LayersIcon,
  Loader2Icon,
  LockIcon,
  SparklesIcon,
  Trash2Icon,
  TypeIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Job, isActive, useJobs } from "./use-jobs";

/** Typical wall-clock time per model, for the soft progress bar only. */
const TYPICAL_SECONDS: Record<string, number> = {
  "seedance-2-t2v": 120,
  "seedance-2-i2v": 120,
  "seedance-2-fast-t2v": 60,
  "seedance-2-fast-i2v": 60,
  "kling-v3-pro-t2v": 150,
  "kling-v3-pro-i2v": 150,
  "veo-3-1-lite-t2v": 70,
  "veo-3-1-lite-i2v": 70,
};

type UploadState =
  | { kind: "none" }
  | { kind: "uploading"; preview: string; name: string }
  | { kind: "ready"; preview: string; name: string; url: string }
  | { kind: "error"; preview?: string; message: string };

export type StudioProps = {
  /** Shown above the top bar (used by the browser preview build). */
  banner?: React.ReactNode;
  /** Replace the server download route, e.g. in a sandboxed preview. */
  onDownload?: (job: Job) => Promise<void> | void;
  /** Hide the link to the timeline editor when it isn't available. */
  showEditorLink?: boolean;
};

export function Studio({
  banner,
  onDownload,
  showEditorLink = true,
}: StudioProps = {}) {
  const { jobs, add, update, remove } = useJobs();

  const [mode, setMode] = useState<StudioMode>("text-to-video");
  const [modelId, setModelId] = useState("seedance-2-fast-t2v");
  const [prompt, setPrompt] = useState("");
  const [formatChoice, setFormat] = useState<FormatId>("vertical");
  const [durationChoice, setDuration] = useState(5);
  const [resolutionChoice, setResolution] = useState<Resolution | null>("720p");
  const [upload, setUpload] = useState<UploadState>({ kind: "none" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const models = useMemo(() => modelsForMode(mode), [mode]);
  const model = getModel(modelId) ?? models[0];
  const formats = supportedFormats(model);
  // Always render with settings the selected model supports, so the estimate
  // never reflects an option carried over from the previous model.
  const format = formats.includes(formatChoice) ? formatChoice : formats[0];
  const duration = model.durations.includes(durationChoice)
    ? durationChoice
    : model.defaultDuration;
  const resolution = model.resolutions
    ? resolutionChoice && model.resolutions.includes(resolutionChoice)
      ? resolutionChoice
      : model.defaultResolution
    : null;
  const estimate = estimateCost(model, duration, resolution);

  const switchMode = (next: StudioMode) => {
    if (next === mode) return;
    setMode(next);
    const sameFamily = modelsForMode(next).find((m) => m.label === model.label);
    setModelId((sameFamily ?? modelsForMode(next)[0]).id);
  };

  const selectedJob =
    jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;

  const needsImage = mode === "image-to-video";
  const imageReady = upload.kind === "ready";
  const canGenerate = prompt.trim().length > 0 && (!needsImage || imageReady);

  async function handleFile(file: File) {
    setSubmitError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUpload({ kind: "error", message: "Use a JPG, PNG or WebP image" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUpload({ kind: "error", message: "Image must be 10 MB or smaller" });
      return;
    }
    const preview = URL.createObjectURL(file);
    setUpload({ kind: "uploading", preview, name: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/studio/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUpload({ kind: "ready", preview, name: file.name, url: data.url });
    } catch (e) {
      setUpload({
        kind: "error",
        preview,
        message: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  async function submit() {
    setConfirmOpen(false);
    setSubmitError(null);
    const id = `job_${Date.now().toString(36)}`;
    const imageUrl = upload.kind === "ready" ? upload.url : undefined;
    const job: Job = {
      id,
      modelId: model.id,
      modelLabel: model.label,
      mode,
      prompt: prompt.trim(),
      imageUrl: needsImage ? imageUrl : undefined,
      format,
      duration,
      resolution,
      estimateUsd: estimate.usd,
      createdAt: Date.now(),
      status: "submitting",
      logs: [],
    };
    add(job);
    setSelectedJobId(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          prompt: job.prompt,
          imageUrl: job.imageUrl,
          format,
          duration,
          resolution,
          approvedCostUsd: estimate.usd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start generation");
      update(id, {
        requestId: data.requestId,
        endpointId: data.endpointId,
        status: "queued",
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not start generation";
      update(id, { status: "failed", error: message, finishedAt: Date.now() });
      setSubmitError(message);
    }
  }

  const activeCount = jobs.filter(isActive).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:overflow-hidden">
      {banner}
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-background-dark/80 px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="AIVA Motion Studio home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            <LockIcon className="h-3 w-3 text-electric" /> API key secured
            server-side
          </span>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-electric">
              <Loader2Icon className="h-3 w-3 animate-spin" /> {activeCount}{" "}
              rendering
            </span>
          )}
          {showEditorLink && (
            <Link
              href="/app"
              className="ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <LayersIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline editor</span>
            </Link>
          )}
        </nav>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* Controls */}
        <aside className="flex w-full flex-col border-border bg-background-light lg:w-[400px] lg:min-h-0 lg:border-r">
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {/* Mode */}
            <div
              role="tablist"
              aria-label="Generation mode"
              className="grid grid-cols-2 rounded-lg border border-border bg-background-dark p-1"
            >
              {(
                [
                  ["text-to-video", "Text to video", TypeIcon],
                  ["image-to-video", "Image to video", ImageIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                    mode === value
                      ? "bg-primary text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--electric))]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Reference image */}
            {needsImage && (
              <Section label="Reference image" hint="Becomes the first frame">
                <ImageDrop
                  upload={upload}
                  onFile={handleFile}
                  onClear={() => setUpload({ kind: "none" })}
                />
              </Section>
            )}

            {/* Prompt */}
            <Section
              label={needsImage ? "Describe the motion" : "Describe the scene"}
              hint={`${prompt.length}/${MAX_PROMPT_LENGTH}`}
            >
              <textarea
                value={prompt}
                maxLength={MAX_PROMPT_LENGTH}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder={
                  needsImage
                    ? "Slow push-in as the product rotates, soft studio light sweeps across the surface…"
                    : "Golden hour drone shot over a coastal city, camera glides toward a glass tower, cinematic, 35mm…"
                }
                className="w-full resize-none rounded-lg border border-input bg-background-dark px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Section>

            {/* Model */}
            <Section label="Model">
              <div className="space-y-2" role="radiogroup" aria-label="Model">
                {models.map((m) => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    selected={m.id === model.id}
                    onSelect={() => setModelId(m.id)}
                  />
                ))}
              </div>
            </Section>

            {/* Format */}
            <Section label="Format">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {(["vertical", "square", "landscape", "match"] as FormatId[])
                  .filter((f) => f !== "match" || needsImage)
                  .map((f) => {
                    const supported = formats.includes(f);
                    return (
                      <button
                        key={f}
                        disabled={!supported}
                        onClick={() => setFormat(f)}
                        aria-pressed={format === f}
                        title={
                          supported
                            ? FORMATS[f].hint
                            : `${model.label} doesn't support ${FORMATS[f].label.toLowerCase()}`
                        }
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                          format === f && supported
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-silver/40",
                          !supported && "cursor-not-allowed opacity-35",
                        )}
                      >
                        <FormatGlyph
                          id={f}
                          active={format === f && supported}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {FORMATS[f].label}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {supported
                              ? f === "match"
                                ? "Auto"
                                : FORMATS[f].ratio
                              : "Not supported"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            </Section>

            {/* Duration + resolution */}
            <Section label="Clip length">
              <Chips
                options={model.durations.map((d) => ({
                  value: String(d),
                  label: `${d}s`,
                }))}
                value={String(duration)}
                onChange={(v) => setDuration(Number(v))}
              />
            </Section>
            {model.resolutions && (
              <Section label="Resolution">
                <Chips
                  options={model.resolutions.map((r) => ({
                    value: r,
                    label: r,
                  }))}
                  value={resolution ?? ""}
                  onChange={(v) => setResolution(v as Resolution)}
                />
              </Section>
            )}
          </div>

          {/* Generate */}
          <div className="border-t border-border bg-background-dark/60 p-5">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Estimated cost
                </div>
                <div
                  className="text-2xl font-semibold tabular-nums"
                  data-testid="estimate"
                >
                  {estimate.approximate ? "≈ " : ""}${estimate.usd.toFixed(2)}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{model.label}</div>
                <div>
                  {duration}s · {FORMATS[format].label}
                  {resolution ? ` · ${resolution}` : ""}
                </div>
              </div>
            </div>
            {submitError && (
              <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-red-200">
                {submitError}
              </p>
            )}
            <button
              disabled={!canGenerate}
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_hsl(var(--electric))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <SparklesIcon className="h-4 w-4" />
              Generate clip
            </button>
            {!canGenerate && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {needsImage && !imageReady
                  ? "Upload a reference image and describe the motion"
                  : "Describe your scene to continue"}
              </p>
            )}
          </div>
        </aside>

        {/* Stage */}
        <main ref={stageRef} className="flex flex-1 flex-col lg:min-h-0">
          <div className="aiva-stage-bg flex min-h-[420px] flex-1 items-center justify-center p-6 lg:min-h-0">
            <Stage job={selectedJob} onDownload={onDownload} />
          </div>
          <History
            jobs={jobs}
            selectedId={selectedJob?.id ?? null}
            onSelect={setSelectedJobId}
            onRemove={remove}
          />
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={submit}
        model={model}
        format={format}
        duration={duration}
        resolution={resolution}
        estimate={estimate}
      />
    </div>
  );
}

/* ---------- pieces ---------- */

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-silver">
          {label}
        </h2>
        {hint && (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn(
            "min-w-[3rem] rounded-md border px-3 py-1.5 text-sm tabular-nums transition",
            o.value === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-silver/40 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: StudioModel;
  selected: boolean;
  onSelect: () => void;
}) {
  const from = estimateCost(
    model,
    model.defaultDuration,
    model.defaultResolution,
  );
  const formatLabels = supportedFormats(model)
    .map((f) => (f === "match" ? "Match" : FORMATS[f].ratio))
    .join(" · ");
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition",
        selected
          ? "border-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--electric)/0.4)]"
          : "border-border hover:border-silver/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary" : "border-silver/40",
        )}
      >
        {selected && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{model.label}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              model.tier === "premium"
                ? "bg-silver/15 text-silver"
                : "bg-electric/15 text-electric",
            )}
          >
            {model.tier === "fast" && <ZapIcon className="h-2.5 w-2.5" />}
            {model.tier}
          </span>
        </span>
        <span className="block text-xs text-muted-foreground">
          {model.tagline}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground/80">
          {model.family} · {formatLabels} · from {from.approximate ? "≈" : ""}$
          {from.usd.toFixed(2)}
        </span>
      </span>
    </button>
  );
}

function FormatGlyph({ id, active }: { id: FormatId; active: boolean }) {
  const f = FORMATS[id];
  const scale = 22 / Math.max(f.w, f.h);
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      <span
        className={cn(
          "rounded-[3px] border-2",
          id === "match" && "border-dashed",
          active ? "border-electric" : "border-silver/60",
        )}
        style={{ width: f.w * scale, height: f.h * scale }}
      />
    </span>
  );
}

function ImageDrop({
  upload,
  onFile,
  onClear,
}: {
  upload: UploadState;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const preview = "preview" in upload ? upload.preview : undefined;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid="image-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-background-dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Reference"
            className="max-h-48 w-full object-contain"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {upload.kind === "uploading" && (
                <Loader2Icon className="h-3 w-3 animate-spin text-electric" />
              )}
              {upload.kind === "ready" && (
                <CheckIcon className="h-3 w-3 text-electric" />
              )}
              {upload.kind === "error" && (
                <AlertTriangleIcon className="h-3 w-3 text-red-300" />
              )}
              <span className="truncate">
                {upload.kind === "uploading"
                  ? "Uploading…"
                  : upload.kind === "ready"
                    ? upload.name
                    : upload.kind === "error"
                      ? upload.message
                      : ""}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded px-2 py-1 hover:bg-accent"
              >
                Replace
              </button>
              <button
                onClick={onClear}
                aria-label="Remove image"
                className="rounded p-1 hover:bg-accent"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
            drag
              ? "border-primary bg-primary/10"
              : "border-border hover:border-silver/40",
          )}
        >
          <ImagePlusIcon className="h-6 w-6 text-electric" />
          <span className="text-sm font-medium">
            Drop an image or click to upload
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG or WebP · up to 10 MB
          </span>
          {upload.kind === "error" && (
            <span className="text-xs text-red-300">{upload.message}</span>
          )}
        </button>
      )}
    </div>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [active]);
  return now;
}

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function frameStyle(job: Job): React.CSSProperties {
  const f = job.format === "match" ? null : FORMATS[job.format];
  const ratio = f ? `${f.w} / ${f.h}` : "16 / 9";
  return { aspectRatio: ratio };
}

function Stage({
  job,
  onDownload,
}: {
  job: Job | null;
  onDownload?: StudioProps["onDownload"];
}) {
  const active = !!job && isActive(job);
  const now = useNow(active);

  if (!job) {
    return (
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-navy shadow-[0_0_60px_-10px_hsl(var(--electric)/0.6)]">
          <FilmIcon className="h-7 w-7 text-electric" />
        </div>
        <h1 className="aiva-silver-text text-3xl font-semibold tracking-tight">
          Direct your next shot
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Describe a scene or upload a reference frame, pick a format, and AIVA
          Motion Studio renders a short clip. You approve the cost before
          anything is generated.
        </p>
      </div>
    );
  }

  const isMatch = job.format === "match";
  const typical = TYPICAL_SECONDS[job.modelId] ?? 90;
  const runningFor = job.startedAt ? now - job.startedAt : 0;
  const pct =
    job.status === "running"
      ? Math.min(92, 8 + (runningFor / 1000 / typical) * 84)
      : job.status === "queued"
        ? 6
        : 2;

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-background-dark shadow-[0_30px_80px_-30px_hsl(var(--electric)/0.5)]",
          "max-h-[62vh] w-auto",
        )}
        style={
          job.status === "completed" && isMatch
            ? { maxWidth: "100%" }
            : {
                ...frameStyle(job),
                height: "min(62vh, 640px)",
                maxWidth: "100%",
              }
        }
        data-testid="stage-frame"
      >
        {job.status === "completed" && job.videoUrl ? (
          // biome-ignore lint/a11y/useMediaCaption: generated clip, no captions available
          <video
            key={job.videoUrl}
            src={job.videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="h-full max-h-[62vh] w-full object-contain"
            data-testid="result-video"
          />
        ) : job.status === "failed" ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertTriangleIcon className="h-8 w-8 text-red-300" />
            <div className="text-sm font-medium">Generation failed</div>
            <p className="max-w-sm text-xs text-muted-foreground">
              {job.error}
            </p>
          </div>
        ) : (
          <div className="relative flex h-full min-h-[240px] flex-col items-center justify-center gap-4 p-8 text-center">
            {job.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
              />
            )}
            <div className="absolute inset-0 overflow-hidden">
              <div className="aiva-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-electric/10 to-transparent" />
            </div>
            <Loader2Icon className="relative h-8 w-8 animate-spin text-electric" />
            <div className="relative text-sm font-medium">
              {job.status === "submitting"
                ? "Submitting…"
                : job.status === "queued"
                  ? `In queue${job.queuePosition != null ? ` · position ${job.queuePosition + 1}` : ""}`
                  : "Rendering your clip"}
            </div>
            {job.status === "running" && (
              <div className="relative text-xs tabular-nums text-muted-foreground">
                {fmtElapsed(runningFor)} elapsed · typically ~
                {Math.round(typical / 60) || 1} min
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress + meta */}
      <div className="w-full max-w-2xl space-y-3">
        {active && (
          <div data-testid="progress">
            <Steps status={job.status} />
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-electric to-electric-glow transition-[width] duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
            {job.logs.length > 0 && (
              <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                › {job.logs[job.logs.length - 1]}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm">{job.prompt}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.modelLabel} · {FORMATS[job.format].label} · {job.duration}s
              {job.resolution ? ` · ${job.resolution}` : ""} · est. $
              {job.estimateUsd.toFixed(2)}
              {job.finishedAt && job.status === "completed"
                ? ` · ready in ${fmtElapsed(job.finishedAt - job.createdAt)}`
                : ""}
            </p>
          </div>
          {job.status === "completed" && job.videoUrl && onDownload && (
            <button
              type="button"
              onClick={() => onDownload(job)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B1A3A] transition hover:bg-silver"
              data-testid="download"
            >
              <DownloadIcon className="h-4 w-4" />
              Download MP4
            </button>
          )}
          {job.status === "completed" && job.videoUrl && !onDownload && (
            <a
              href={`/api/download?url=${encodeURIComponent(job.videoUrl)}&filename=${encodeURIComponent(`aiva-${job.id}.mp4`)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0B1A3A] transition hover:bg-silver"
              data-testid="download"
            >
              <DownloadIcon className="h-4 w-4" />
              Download MP4
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ status }: { status: Job["status"] }) {
  const steps = [
    { key: "submitting", label: "Submitted" },
    { key: "queued", label: "Queued" },
    { key: "running", label: "Rendering" },
    { key: "completed", label: "Ready" },
  ];
  const idx = steps.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center justify-between text-[11px]">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={cn(
            "flex items-center gap-1.5",
            i < idx
              ? "text-silver"
              : i === idx
                ? "text-electric"
                : "text-muted-foreground/50",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              i < idx
                ? "bg-silver"
                : i === idx
                  ? "bg-electric"
                  : "bg-muted-foreground/40",
            )}
          />
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function History({
  jobs,
  selectedId,
  onSelect,
  onRemove,
}: {
  jobs: Job[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (jobs.length === 0) return null;
  return (
    <div className="border-t border-border bg-background-light px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-silver">
          Your clips
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Saved in this browser
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {jobs.map((j) => {
          const f = FORMATS[j.format];
          return (
            <div key={j.id} className="group relative shrink-0">
              <button
                onClick={() => onSelect(j.id)}
                className={cn(
                  "relative flex h-24 items-center justify-center overflow-hidden rounded-lg border bg-background-dark transition",
                  j.id === selectedId
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border hover:border-silver/40",
                )}
                style={{
                  aspectRatio:
                    j.format === "match" ? "4 / 3" : `${f.w} / ${f.h}`,
                }}
                title={j.prompt}
              >
                {j.status === "completed" && j.videoUrl ? (
                  <video
                    src={`${j.videoUrl}#t=0.5`}
                    muted
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : j.status === "failed" ? (
                  <AlertTriangleIcon className="h-5 w-5 text-red-300" />
                ) : (
                  <Loader2Icon className="h-5 w-5 animate-spin text-electric" />
                )}
                <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1 text-[10px]">
                  <ClockIcon className="h-2.5 w-2.5" />
                  {j.duration}s
                </span>
              </button>
              {!isActive(j) && (
                <button
                  onClick={() => onRemove(j.id)}
                  aria-label="Remove from history"
                  className="absolute -right-1.5 -top-1.5 hidden rounded-full border border-border bg-background p-1 group-hover:block"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  model,
  format,
  duration,
  resolution,
  estimate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  model: StudioModel;
  format: FormatId;
  duration: number;
  resolution: Resolution | null;
  estimate: ReturnType<typeof estimateCost>;
}) {
  const rows: [string, string][] = [
    ["Model", `${model.label} (${model.family})`],
    ["Endpoint", model.endpointId],
    [
      "Format",
      `${FORMATS[format].label}${format === "match" ? "" : ` · ${FORMATS[format].ratio}`}`,
    ],
    ["Clip length", `${duration} seconds`],
    ...(resolution ? ([["Resolution", resolution]] as [string, string][]) : []),
    ["Pricing", estimate.breakdown],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background-light sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve this generation</DialogTitle>
          <DialogDescription>
            This runs a paid model on your fal account.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate text-right font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 bg-primary/10 px-3 py-3">
            <dt className="font-medium">Estimated cost</dt>
            <dd
              className="text-xl font-semibold tabular-nums text-electric"
              data-testid="confirm-cost"
            >
              {estimate.approximate ? "≈ " : ""}${estimate.usd.toFixed(2)}
            </dd>
          </div>
        </dl>
        {estimate.approximate && (
          <p className="text-xs text-muted-foreground">
            Token-priced model: the final charge depends on the exact output
            size fal reports.
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
            data-testid="approve"
          >
            <SparklesIcon className="h-4 w-4" />
            Approve &amp; generate
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
