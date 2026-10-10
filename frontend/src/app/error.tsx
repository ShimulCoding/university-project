"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="section-shell flex min-h-screen items-center justify-center py-16">
      <div className="surface-panel w-full max-w-xl p-6 sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/15 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="font-display text-4xl font-normal leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
          The interface hit an unexpected error
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Please retry this page. If the problem continues, return home and
          try again later.
        </p>
        {error.digest ? (
          <div className="mt-5 rounded-xl border border-border/70 bg-panel-muted px-4 py-3 font-mono text-xs text-muted-foreground">
            Digest: {error.digest}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Retry page</Button>
          <Button asChild variant="outline">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
