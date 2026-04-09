import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gradient-to-r from-secondary via-panel-muted to-secondary bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
