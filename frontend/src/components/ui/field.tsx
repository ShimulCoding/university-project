"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  description?: string;
  error?: string | null | undefined;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  description,
  error,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const childElements = Children.toArray(children);
  const child = childElements.find(
    (element) => isValidElement(element) && element.type !== "datalist",
  ) as
    | ReactElement<{
        id?: string | undefined;
        "aria-describedby"?: string | undefined;
        "aria-invalid"?: boolean | "true" | "false" | undefined;
      }>
    | undefined;
  const id = child?.props.id ?? generatedId;
  const describedBy = [
    child?.props["aria-describedby"],
    description ? `${id}-help` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("block min-w-0 space-y-2", className)}>
      <label
        htmlFor={id}
        className={cn(
          "block text-sm font-medium",
          error ? "text-destructive" : "text-foreground",
        )}
      >
        {label}
      </label>
      {description ? (
        <span
          id={`${id}-help`}
          className="block text-xs leading-5 text-muted-foreground"
        >
          {description}
        </span>
      ) : null}
      {childElements.map((element) =>
        child && element === child
          ? cloneElement(child, {
              id,
              "aria-describedby": describedBy || undefined,
              "aria-invalid": error ? true : child.props["aria-invalid"],
            })
          : element,
      )}
      {error ? (
        <span
          id={`${id}-error`}
          role="alert"
          className="block text-xs leading-5 text-destructive"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
