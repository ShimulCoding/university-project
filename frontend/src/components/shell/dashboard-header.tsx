"use client";
import Link from "next/link";
import type { UserProfile } from "@/types";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { LogoutButton } from "@/components/student/logout-button";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader({ user }: { user: UserProfile }) {
  return (
    <header className="workspace-context">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-panel text-success">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-semibold">System Admin workspace</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Global governance · {user.fullName}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="info">Global overview</Badge>
        <Link
          className="focus-ring flex min-h-11 items-center gap-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
          href="/financial-summaries"
        >
          Public site{" "}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <LogoutButton redirectTo="/" />
      </div>
    </header>
  );
}
