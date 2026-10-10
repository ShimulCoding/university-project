import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-medium leading-5 text-muted-foreground">
          {label}
        </span>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-success">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4 break-words text-3xl font-semibold leading-tight tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Card>
  );
}
