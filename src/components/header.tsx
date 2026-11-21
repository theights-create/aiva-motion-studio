"use client";

import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import Link from "next/link";

export default function Header() {
  return (
    <header className="px-4 py-2 flex justify-between items-center border-b border-border">
      <h1 className="text-lg font-medium">
        <Link href="/">
          <Logo />
        </Link>
      </h1>
      <nav className="flex flex-row items-center justify-end gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Motion Studio</Link>
        </Button>
      </nav>
    </header>
  );
}
