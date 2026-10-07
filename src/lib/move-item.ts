/**
 * Array reorder without pulling @dnd-kit's arrayMove into a bundle. Callers on
 * the public marketing pages must stay free of the drag-and-drop libraries.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
}
