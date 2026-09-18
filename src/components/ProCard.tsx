import type { MarketplaceProfessional } from "@/lib/types/marketplace";
import { Star, MapPin, BadgeCheck, Heart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ProCard({
  pro,
  onShowLocation,
  onCardClick,
  profileHref,
  requireLogin = false,
}: {
  pro: MarketplaceProfessional;
  onShowLocation?: () => void;
  onCardClick?: () => void;
  profileHref?: string;
  requireLogin?: boolean;
}) {
  const initial = pro.name.slice(0, 1).toUpperCase();
  const destination = profileHref ?? `/pro/${pro.id}`;
  const hireHref = requireLogin ? `/login?next=${encodeURIComponent(destination)}` : destination;
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated ${onCardClick ? "cursor-pointer" : ""}`}
      onClick={onCardClick}
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onCardClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardClick();
        }
      }}
    >
      <button
        type="button"
        aria-label={`Save ${pro.name}`}
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface/80 text-muted-foreground hover:bg-surface hover:text-cta"
      >
        <Heart className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {pro.avatar ? (
            <img src={pro.avatar} alt={pro.name} className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div
              aria-hidden
              className="grid h-14 w-14 place-items-center rounded-xl bg-muted text-lg font-semibold"
            >
              {initial}
            </div>
          )}
          {pro.verified && (
            <span className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-card">
              <BadgeCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold text-foreground">
            {pro.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{pro.title}</p>
          {pro.rating >= 4.8 && pro.reviews >= 3 && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-cta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cta">
              <Star className="h-2.5 w-2.5 fill-cta" /> Top rated
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <Star className="h-3 w-3 fill-warning text-warning" />
          {pro.rating.toFixed(1)}
          <span className="font-normal text-muted-foreground">({pro.reviews})</span>
        </span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {pro.location ?? "Remote"}
        </span>
        {pro.approximateDistanceKm != null && (
          <>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="font-semibold text-primary">
              {pro.approximateDistanceKm < 1
                ? "< 1 km away"
                : `${pro.approximateDistanceKm.toFixed(1)} km away`}
            </span>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {pro.skills.slice(0, 3).map((skill) => (
          <span
            key={skill}
            className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting at</p>
          <p>
            <span className="font-display text-2xl font-bold text-foreground">
              {pro.hourlyRate === null ? "Contact" : `₹${pro.hourlyRate}`}
            </span>
            {pro.hourlyRate !== null && <span className="text-sm text-muted-foreground">/hr</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onShowLocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={(event) => {
                event.stopPropagation();
                onShowLocation();
              }}
            >
              <MapPin className="h-4 w-4" />
              Show on map
            </Button>
          )}
          <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link href={hireHref} onClick={(event) => event.stopPropagation()}>
              Hire
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
