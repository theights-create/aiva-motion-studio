import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Timeline Editor · AIVA Motion Studio",
};

export default function EditorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
