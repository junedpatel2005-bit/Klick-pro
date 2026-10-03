import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalizeFirst(value: string | null | undefined): string {
  if (!value) return "";
  const firstIndex = value.search(/\S/);
  if (firstIndex === -1) return value;
  return (
    value.slice(0, firstIndex) +
    value.charAt(firstIndex).toUpperCase() +
    value.slice(firstIndex + 1)
  );
}
