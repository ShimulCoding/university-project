import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StateTone = "empty" | "loading" | "warning" | "error" | "success";

const toneStyles: Record<StateTone, string> = {
  empty: "border-border/70 bg-panel-muted",
  loading: "border-border/70 bg-panel",
  warning: "border-warning/20 bg-warning-muted",
  error: "border-destructive/20 bg-destructive/5",
  success: "border-success/20 bg-success-muted",
};

const toneBadges: Record<StateTone, { label: string; variant: "neutral" | "warning" | "danger" | "success" | "info" }> = {
  empty: { label: "Empty", variant: "neutral" },
  loading: { label: "Loading", variant: "info" },
  warning: { label: "Needs review", variant: "warning" },
  error: { label: "Attention", variant: "danger" },
  success: { label: "Healthy", variant: "success" },
};

type StatePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: StateTone;
  action?: React.ReactNode;
  className?: string;
};

export function StatePanel({
  icon: Icon,
  title,
  description,
  tone = "empty",
  action,
  className,
}: StatePanelProps) {
  return (
    <Card tone="muted" className={cn("border-dashed", toneStyles[tone], className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-border/70 bg-panel p-3 text-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <Badge variant={toneBadges[tone].variant}>{toneBadges[tone].label}</Badge>
            <CardTitle className="mt-3 text-base">{title}</CardTitle>
            <CardDescription className="mt-2 max-w-xl">{description}</CardDescription>
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-0" />
    </Card>
  );
}
