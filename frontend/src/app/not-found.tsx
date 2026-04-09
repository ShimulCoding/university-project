import Link from "next/link";
import { SearchSlash } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="section-shell flex min-h-screen items-center justify-center py-16">
      <div className="surface-panel max-w-xl p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-panel-muted text-primary">
          <SearchSlash className="h-5 w-5" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
          This route is outside the current platform surface
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          The frontend foundation currently includes a public landing layer and an
          internal dashboard shell. This address has not been designed yet.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/">Go to landing page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Open internal preview</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
