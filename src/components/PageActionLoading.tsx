import { LoaderCircle } from "lucide-react";

export function PageActionLoading({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description?: string;
}) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-background/95 p-7 text-center shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />
        </div>
        <p className="mt-5 font-display text-xl font-bold text-foreground">{title}</p>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        <div className="mx-auto mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-primary/10">
          <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
