import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "motion-safe:animate-pulse rounded-xl bg-gradient-to-r from-secondary via-panel-muted to-secondary bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
