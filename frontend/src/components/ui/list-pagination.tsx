"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Pagination } from "@/lib/api/list";
import { Button } from "@/components/ui/button";

export function ListPagination({ pagination }: { pagination: Pagination }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (page: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    return `${pathname}?${next}`;
  };
  return <nav aria-label="Result pages" className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border py-5">
    <p className="text-xs text-muted-foreground">Page <span className="font-semibold text-foreground">{pagination.page}</span> of {Math.max(1, pagination.totalPages)} · {pagination.totalItems} results</p>
    <div className="flex gap-3">
      {pagination.page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(pagination.page - 1)}>Previous</Link></Button> : null}
      {pagination.page < pagination.totalPages ? <Button asChild size="sm" variant="outline"><Link href={href(pagination.page + 1)}>Next</Link></Button> : null}
    </div>
  </nav>;
}
