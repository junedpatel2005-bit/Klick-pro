import { Award, BriefcaseBusiness, HeartHandshake, ShieldCheck, UsersRound } from "lucide-react";
import type { FormEvent } from "react";
import type { CmsCard, CmsIcon } from "@/lib/cms-file";

const iconMap: Record<CmsIcon, typeof ShieldCheck> = {
  shield: ShieldCheck,
  handshake: HeartHandshake,
  award: Award,
  briefcase: BriefcaseBusiness,
  users: UsersRound,
};
export function AboutFeatureCard({
  card,
  editable = false,
  selected = false,
  onChange,
  onSelect,
  onDelete,
}: {
  card: CmsCard;
  editable?: boolean;
  selected?: boolean;
  onChange?: (changes: Partial<CmsCard>) => void;
  onSelect?: () => void;
  onDelete?: () => void;
}) {
  const Icon = iconMap[card.icon] ?? ShieldCheck;
  const props = (field: "title" | "description") =>
    editable
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onPointerDown: (event: React.PointerEvent<HTMLElement>) => event.stopPropagation(),
          onInput: (event: FormEvent<HTMLElement>) =>
            onChange?.({ [field]: event.currentTarget.textContent ?? "" }),
        }
      : {};
  return (
    <article
      onClick={editable ? onSelect : undefined}
      className={`relative rounded-2xl border border-border bg-card p-7 shadow-soft ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <Icon className="h-7 w-7 text-primary" />
      <h2 className="mt-5 font-display text-xl font-semibold" {...props("title")}>
        {card.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground" {...props("description")}>
        {card.description}
      </p>
      {editable && selected && (
        <div className="absolute -top-3 right-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 text-xs shadow-lg">
          <label className="text-muted-foreground">
            Icon{" "}
            <select
              value={card.icon}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange?.({ icon: e.target.value as CmsIcon })}
              className="bg-background text-foreground"
            >
              <option value="shield">Shield</option>
              <option value="handshake">Handshake</option>
              <option value="award">Award</option>
              <option value="briefcase">Briefcase</option>
              <option value="users">Users</option>
            </select>
          </label>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="text-destructive"
          >
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
