import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function FilterCard({
  children,
  resetHref,
}: {
  children: React.ReactNode;
  resetHref: string;
}) {
  return (
    <Card tone="muted" className="p-5">
      <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
        <div className="flex flex-wrap gap-3 xl:justify-end">
          <Button type="submit" size="sm">
            <Search className="h-4 w-4" />
            Apply filters
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <a href={resetHref}>Reset</a>
          </Button>
        </div>
      </form>
    </Card>
  );
}
