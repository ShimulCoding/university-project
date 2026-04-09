import { Skeleton } from "@/components/ui/skeleton";

export default function FinancialSummariesLoading() {
  return (
    <main className="section-shell py-12 sm:py-16">
      <div className="surface-panel p-8">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-10 w-[32rem] max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-3xl" />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="surface-panel p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-5 h-5 w-2/3" />
            <Skeleton className="mt-5 h-28 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
