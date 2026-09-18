import type { CmsCard } from "@/lib/cms-file";
import { AboutFeatureCard } from "@/components/AboutFeatureCard";
export function AboutFeatureGrid({
  cards,
  editable = false,
  selectedId,
  onSelect,
  onChange,
  onDelete,
}: {
  cards: CmsCard[];
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange?: (id: string, changes: Partial<CmsCard>) => void;
  onDelete?: (id: string) => void;
}) {
  const layout =
    cards.length === 1
      ? "max-w-md"
      : cards.length === 2
        ? "md:grid-cols-2"
        : cards.length === 3
          ? "md:grid-cols-3"
          : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`mx-auto grid w-full gap-6 ${layout}`}>
      {cards.map((card) => (
        <div key={card.id}>
          <AboutFeatureCard
            card={card}
            editable={editable}
            selected={selectedId === card.id}
            onSelect={editable ? () => onSelect?.(card.id) : undefined}
            onChange={editable ? (changes) => onChange?.(card.id, changes) : undefined}
            onDelete={editable ? () => onDelete?.(card.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
