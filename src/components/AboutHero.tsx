import type { FormEvent } from "react";

export function AboutHero({
  label,
  title,
  description,
  editable = false,
  onChange,
}: {
  label: string;
  title: string;
  description: string;
  editable?: boolean;
  onChange?: (field: "label" | "title" | "description", value: string) => void;
}) {
  const props = (field: "label" | "title" | "description") =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onInput: (event: FormEvent<HTMLElement>) =>
            onChange?.(field, event.currentTarget.textContent ?? ""),
        }
      : {};
  return (
    <section className="gradient-hero">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p
          className="text-xs font-semibold uppercase tracking-wider text-primary"
          {...props("label")}
        >
          {label}
        </p>
        <h1
          className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl"
          {...props("title")}
        >
          {title}
        </h1>
        <p
          className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
          {...props("description")}
        >
          {description}
        </p>
      </div>
    </section>
  );
}
