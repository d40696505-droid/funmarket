import type { Service } from "@/lib/api";

export const SERVICE_STATUS_LABEL: Record<Service["status"], string> = {
  draft: "Черновик",
  moderation: "На модерации",
  active: "Активно",
  inactive: "Неактивно",
};

export const SERVICE_STATUS_COLOR: Record<Service["status"], string> = {
  draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  moderation: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};
