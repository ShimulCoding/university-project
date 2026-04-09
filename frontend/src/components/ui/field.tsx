import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, description, className, children }: FieldProps) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {description ? (
        <span className="block text-sm leading-6 text-muted-foreground">{description}</span>
      ) : null}
      {children}
    </label>
  );
}
