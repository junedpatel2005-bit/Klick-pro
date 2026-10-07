"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * The only module that imports @dnd-kit. CMS editing is the sole consumer, so
 * pages load this lazily and public visitors never download the libraries.
 */

export type DragHandle = {
  ref: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  handleProps: Record<string, unknown>;
  isDragging: boolean;
};

export function SortableBoard({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event: DragEndEvent) => {
        if (!event.over || event.active.id === event.over.id) return;
        const from = ids.indexOf(String(event.active.id));
        const to = ids.indexOf(String(event.over.id));
        if (from >= 0 && to >= 0) onReorder(from, to);
      }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (drag: DragHandle) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <>
      {children({
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        handleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </>
  );
}
