import { ControlsShowcase } from "@/components/foundation/controls-showcase";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ShieldCheck, Layers, LayoutTemplate } from "lucide-react";

export default function DashboardControlsPage() {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-sm backdrop-blur-xl px-8 py-10 lg:px-12 lg:py-12">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/5 opacity-50 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
        
        <div className="relative z-10 flex flex-col gap-5 max-w-3xl">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="neutral" className="px-3 py-1 font-semibold tracking-wide uppercase border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
              <Layers className="w-3.5 h-3.5 mr-1.5 inline-block" />
              UI Foundation
            </Badge>
            <Badge variant="neutral" className="px-3 py-1 font-medium tracking-wide border-muted-foreground/20 bg-muted/50 text-muted-foreground backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline-block" />
              Standardized Patterns
            </Badge>
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            System <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/90 to-primary/60">Controls & Patterns</span>
          </h1>
          
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed font-medium">
            This module establishes the standardized interface components and interaction patterns used across all university administration dashboards, ensuring consistency, reliability, and an intuitive user experience.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Badge variant="neutral" className="bg-background/80 backdrop-blur-sm border-border/60 text-sm py-1.5 px-3 shadow-sm">
              <LayoutTemplate className="w-4 h-4 mr-2 inline-block text-primary/70" />
              Reusable Architecture
            </Badge>
          </div>
        </div>
      </section>

      <ControlsShowcase />
    </div>
  );
}