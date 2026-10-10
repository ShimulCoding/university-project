import { Landmark, LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-canvas px-6"
    >
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Landmark className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle
            className="h-4 w-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
          {label}
        </div>
      </div>
    </div>
  );
}
