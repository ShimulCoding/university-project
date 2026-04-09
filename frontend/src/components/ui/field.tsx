import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  description?: string;
  error?: string | null | undefined;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, description, error, className, children }: FieldProps) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className={cn("text-sm font-semibold", error ? "text-destructive" : "text-foreground")}>
        {label}
      </span>
      {description ? (
        <span className="block text-sm leading-6 text-muted-foreground">{description}</span>
      ) : null}
      {children}
      {error ? <span className="block text-sm text-destructive">{error}</span> : null}
    </label>
  );
}
