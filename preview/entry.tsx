import "./mock-api";
import { Studio } from "@/components/studio/studio";
import type { Job } from "@/components/studio/use-jobs";
import { useState } from "react";
import { createRoot } from "react-dom/client";

type Downloads = {
  save: (req: { filename: string; data: Blob }) => Promise<{ status: string }>;
};
type ClaudeRuntime = { use?: (name: string) => Promise<unknown> };

const runtime = (window as unknown as { claude?: ClaudeRuntime }).claude;

function getDownloads(): Promise<Downloads | null> {
  if (!runtime?.use) return Promise.resolve(null);
  return runtime.use("downloads").then(
    (d) => (d as Downloads | null) ?? null,
    () => null,
  );
}

function Preview() {
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4000);
  };

  async function onDownload(job: Job) {
    if (!job.videoUrl) return;
    const downloads = await getDownloads();
    if (!downloads) {
      flash(
        "Saving files isn't available in this view. Open the preview on claude.ai to download.",
      );
      return;
    }
    try {
      const blob = await (await fetch(job.videoUrl)).blob();
      const res = await downloads.save({
        filename: `aiva-${job.id}.mp4`,
        data: blob,
      });
      flash(res.status === "saved" ? "Clip saved" : "Clip sent");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      flash(
        code === "declined"
          ? "Download cancelled"
          : "Couldn't save the clip. Try again.",
      );
    }
  }

  return (
    <>
      <Studio
        showEditorLink={false}
        onDownload={onDownload}
        banner={
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-electric/30 bg-electric/10 px-4 py-2 text-center text-xs text-silver">
            <span className="rounded bg-electric px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Preview
            </span>
            <span>
              Generation is simulated with a sample clip. No fal credits are
              used.
            </span>
          </div>
        }
      />
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-background-light px-4 py-2 text-sm shadow-lg"
        >
          {notice}
        </div>
      )}
    </>
  );
}

document.body.classList.add("dark", "antialiased");
const root = document.getElementById("aiva-root");
if (root) createRoot(root).render(<Preview />);
