"use client";

import type { FormatId, Resolution, StudioMode } from "@/lib/studio/models";
import { useCallback, useEffect, useRef, useState } from "react";

export type JobStatus = "submitting" | "queued" | "running" | "completed" | "failed";

export type Job = {
  id: string;
  requestId?: string;
  modelId: string;
  modelLabel: string;
  endpointId?: string;
  mode: StudioMode;
  prompt: string;
  imageUrl?: string;
  format: FormatId;
  duration: number;
  resolution: Resolution | null;
  estimateUsd: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: JobStatus;
  queuePosition?: number;
  logs: string[];
  videoUrl?: string;
  error?: string;
};

const STORAGE_KEY = "aiva.motion.jobs.v1";
const POLL_MS = 2500;
const MAX_HISTORY = 40;

function load(): Job[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const jobs = raw ? (JSON.parse(raw) as Job[]) : [];
    // A submit that never got a request id cannot be resumed.
    return jobs.map((j) =>
      j.status === "submitting"
        ? { ...j, status: "failed", error: "Interrupted before submission" }
        : j,
    );
  } catch {
    return [];
  }
}

function save(jobs: Job[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_HISTORY)));
  } catch {
    // storage unavailable (private mode); history just won't persist
  }
}

export const isActive = (j: Job) =>
  j.status === "submitting" || j.status === "queued" || j.status === "running";

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;

  useEffect(() => {
    setJobs(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(jobs);
  }, [jobs, hydrated]);

  const update = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const add = useCallback((job: Job) => {
    setJobs((prev) => [job, ...prev]);
  }, []);

  const remove = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  // Poll every in-flight job that has a request id.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const tick = async () => {
      const active = jobsRef.current.filter(
        (j) => j.requestId && (j.status === "queued" || j.status === "running"),
      );
      await Promise.all(
        active.map(async (j) => {
          try {
            const res = await fetch(
              `/api/studio/status?modelId=${encodeURIComponent(j.modelId)}&requestId=${encodeURIComponent(j.requestId!)}`,
              { cache: "no-store" },
            );
            const data = await res.json();
            if (cancelled) return;
            if (!res.ok) {
              // transient server/network error: keep polling, surface message
              update(j.id, { logs: [...j.logs.slice(-6), data.error ?? "Status check failed"] });
              return;
            }
            const logs: string[] = data.logs?.length ? data.logs : j.logs;
            if (data.status === "queued") {
              update(j.id, { status: "queued", queuePosition: data.queuePosition, logs });
            } else if (data.status === "running") {
              update(j.id, {
                status: "running",
                startedAt: j.startedAt ?? Date.now(),
                queuePosition: undefined,
                logs,
              });
            } else if (data.status === "completed") {
              update(j.id, {
                status: "completed",
                videoUrl: data.videoUrl,
                finishedAt: Date.now(),
                logs,
              });
            } else if (data.status === "failed") {
              update(j.id, {
                status: "failed",
                error: data.error ?? "Generation failed",
                finishedAt: Date.now(),
                logs,
              });
            }
          } catch {
            // network blip; try again next tick
          }
        }),
      );
    };
    const handle = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [hydrated, update]);

  return { jobs, hydrated, add, update, remove };
}
