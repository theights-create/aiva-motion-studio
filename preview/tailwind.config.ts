import base from "../tailwind.config";

// Same AIVA theme as the app, scanning only what the preview renders.
export default {
  ...base,
  content: [
    "./src/components/studio/**/*.{ts,tsx}",
    "./src/components/logo.tsx",
    "./src/components/ui/dialog.tsx",
    "./preview/**/*.{ts,tsx}",
  ],
};
