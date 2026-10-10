import { Check } from "lucide-react";

export function ParticipationSteps({
  current,
  complete = false,
}: {
  current: 0 | 1 | 2;
  complete?: boolean;
}) {
  return (
    <ol
      aria-label="Participation progress"
      className="mb-6 grid gap-3 rounded-2xl border border-border bg-panel p-4 sm:grid-cols-3 sm:p-5"
    >
      {["Student account", "Event registration", "Payment review"].map(
        (label, index) => {
          const done = index < current || complete;
          return (
            <li
              key={label}
              aria-current={!complete && index === current ? "step" : undefined}
              className="flex items-center gap-3"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-success text-white" : index === current ? "bg-primary text-white" : "border border-border bg-canvas text-muted-foreground"}`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-xs font-medium ${index <= current || complete ? "text-foreground" : "text-muted-foreground"}`}
              >
                {label}
                {done ? <span className="sr-only"> complete</span> : null}
              </span>
            </li>
          );
        },
      )}
    </ol>
  );
}
