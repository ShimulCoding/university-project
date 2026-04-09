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
      <div className="section-shell py-4">
        <div className="flex items-center justify-between gap-6">
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
            <div className="hidden rounded-full border border-success/15 bg-success-muted px-3 py-1 text-xs font-medium text-success lg:block">
              Public-safe views only
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/financial-summaries">Published records</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard">Internal preview</Link>
            </Button>
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden [&::-webkit-scrollbar]:hidden">
          {publicNavigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-panel"
                    : "border-border/70 bg-panel text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
