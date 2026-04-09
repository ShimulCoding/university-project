"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas">
        <main className="section-shell flex min-h-screen items-center justify-center py-16">
          <div className="surface-panel max-w-xl p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/15 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-foreground">
              The interface hit an unexpected error
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              The design system is set up to fail clearly rather than silently. You can
              retry this screen without affecting protected financial data.
            </p>
            {error.digest ? (
              <div className="mt-5 rounded-xl border border-border/70 bg-panel-muted px-4 py-3 font-mono text-xs text-muted-foreground">
                Digest: {error.digest}
              </div>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button onClick={reset}>Retry page</Button>
              <Button asChild variant="outline">
                <a href="/">Return home</a>
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
