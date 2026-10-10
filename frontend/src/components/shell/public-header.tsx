"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { publicNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/shell/app-logo";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const pathname = usePathname();
  const links = publicNavigation.map((item) => {
    const active =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`));
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {item.label}
      </Link>
    );
  });
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-canvas/95 backdrop-blur-xl">
      <div className="section-shell flex min-h-[80px] items-center justify-between gap-3 py-3">
        <AppLogo compact />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {links}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/complaints"
            className="focus-ring hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground xl:flex"
          >
            Student area
          </Link>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
          >
            <Link href="/dashboard">
              System Admin <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
          <details key={pathname} className="group relative lg:hidden">
            <summary
              aria-label="Open navigation"
              className="focus-ring flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-panel [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 top-14 z-50 max-h-[calc(100dvh-7rem)] w-[min(320px,calc(100vw-2rem))] space-y-1 overflow-y-auto rounded-2xl border border-border bg-panel p-3 shadow-lift"
            >
              {links}
              <div className="my-2 h-px bg-border" />
              <Link
                className="focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted"
                href="/complaints"
              >
                Student area
              </Link>
              <Link
                className="focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted"
                href="/dashboard/my-events"
              >
                My event workspaces
              </Link>
              <Link
                className="focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted"
                href="/dashboard"
              >
                System Admin
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
