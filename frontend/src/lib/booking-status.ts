import type { Booking } from "@/lib/api";

export const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждён",
  awaiting_payment: "Ожидает оплаты",
  rejected: "Отклонён",
  cancelled: "Отменён",
  paid: "Оплачен",
  completed: "Завершён",
  disputed: "Спор",
};

export const STATUS_COLOR: Record<Booking["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  awaiting_payment: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  disputed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Точечный цвет для календарной ячейки (без текста) — тот же порядок
// приоритета, что и в STATUS_COLOR, просто компактнее для маленькой точки.
export const STATUS_DOT_COLOR: Record<Booking["status"], string> = {
  pending: "bg-amber-500",
  confirmed: "bg-green-500",
  awaiting_payment: "bg-amber-500",
  rejected: "bg-red-400",
  cancelled: "bg-zinc-400",
  paid: "bg-blue-500",
  completed: "bg-green-600",
  disputed: "bg-red-600",
};
