"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { publicNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/shell/app-logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-canvas/90 backdrop-blur-xl">
      <div className="section-shell flex h-20 items-center justify-between gap-6">
        <AppLogo compact />
        <nav className="hidden items-center gap-1 md:flex">
          {publicNavigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-panel"
                    : "text-muted-foreground hover:bg-panel hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/financial-summaries">Published records</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Internal preview</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
