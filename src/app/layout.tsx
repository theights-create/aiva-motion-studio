import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { geistSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIVA Motion Studio",
  description: "AI video studio by AIVA System. Text and image to video, in every format.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body className="antialiased dark">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
