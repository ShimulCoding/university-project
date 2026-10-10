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
    <Card tone="default" className="p-4 sm:p-5">
      <form aria-label="Filter records" className="flex flex-col gap-4 2xl:flex-row 2xl:items-end">
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">{children}</div>
        <div className="flex shrink-0 flex-wrap gap-2">
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
