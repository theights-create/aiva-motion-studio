// Builds a static, self-contained preview of the AIVA Motion Studio UI.
// Usage: node preview/build.mjs [outDir]   (default: preview/dist)
// The real studio component runs against an in-browser stand-in for the
// /api/studio routes (preview/mock-api.ts), so no fal key or credits are used.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(process.argv[2] ?? path.join(root, "preview/dist"));
mkdirSync(path.join(out, "samples"), { recursive: true });

// 1. JavaScript bundle
const js = await esbuild.build({
  entryPoints: [path.join(root, "preview/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  tsconfig: path.join(root, "tsconfig.json"),
  alias: { "next/link": path.join(root, "preview/shims/next-link.tsx") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const script = js.outputFiles[0].text.replaceAll("</script", "<\\/script");

// 2. CSS (same tokens as the app)
const cssFile = path.join(out, ".preview.css");
execFileSync(
  path.join(root, "node_modules/.bin/tailwindcss"),
  [
    "-c",
    "preview/tailwind.config.ts",
    "-i",
    "src/app/globals.css",
    "-o",
    cssFile,
    "--minify",
  ],
  { cwd: root, stdio: "inherit" },
);
const css = readFileSync(cssFile, "utf8");

// 3. Sample clips, one per format (branded placeholder footage)
const clips = {
  vertical: [720, 1280],
  square: [960, 960],
  landscape: [1280, 720],
};
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
for (const [name, [w, h]] of Object.entries(clips)) {
  const file = path.join(out, `samples/aiva-sample-${name}.mp4`);
  if (existsSync(file)) continue;
  const size = Math.round(Math.min(w, h) / 14);
  const text = existsSync(font)
    ? `,drawtext=fontfile=${font}:text='AIVA SAMPLE CLIP':fontcolor=white@0.92:fontsize=${size}:x=(w-tw)/2:y=(h-th)/2,` +
      `drawtext=fontfile=${font}:text='${name.toUpperCase()}':fontcolor=0xC9D1DC:fontsize=${Math.round(size / 2)}:x=(w-tw)/2:y=(h/2)+${size}`
    : "";
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `gradients=s=${w}x${h}:c0=0x0B1A3A:c1=0x1F7BFF:c2=0x050C1C:speed=0.04:d=4${text},format=yuv420p`,
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:sample_rate=44100:duration=4",
    "-af",
    "volume=0.05",
    "-t",
    "4",
    "-r",
    "24",
    "-c:v",
    "libx264",
    "-crf",
    "30",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-movflags",
    "+faststart",
    file,
  ]);
}

// 4. Page (the artifact host wraps it in its own document skeleton)
const html = `<title>AIVA Motion Studio</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&display=swap">
<style>
/* AIVA Motion Studio is a single dark look: deep navy, electric blue, white, silver. */
:root { color-scheme: dark; background: #050c1c; --font-geist-sans: "Geist"; }
body { background: #050c1c; color: #fff; }
${css}
</style>
<div id="aiva-root"></div>
<script>${script}</script>
`;
writeFileSync(path.join(out, "index.html"), html);
console.log(
  `Preview built: ${path.join(out, "index.html")} (${(html.length / 1024).toFixed(0)} KB)`,
);
