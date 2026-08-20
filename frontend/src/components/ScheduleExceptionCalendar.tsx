"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ScheduleExceptionItem, ScheduleExceptionType } from "@/lib/api";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABELS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Понедельник = 0 ... воскресенье = 6 (JS Date.getDay() возвращает 0 для воскресенья).
function mondayFirst(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function ScheduleExceptionCalendar({
  exceptions,
  defaultCapacity,
  onAdd,
  onRemove,
}: {
  exceptions: ScheduleExceptionItem[];
  defaultCapacity: number;
  onAdd: (data: {
    date: string;
    type: ScheduleExceptionType;
    startTime?: string;
    endTime?: string;
    capacity?: number;
    reason?: string;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [type, setType] = useState<ScheduleExceptionType>("available");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState(String(defaultCapacity));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleExceptionItem[]>();
    for (const ex of exceptions) {
      const list = map.get(ex.date) ?? [];
      list.push(ex);
      map.set(ex.date, list);
    }
    return map;
  }, [exceptions]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = mondayFirst(new Date(year, month, 1).getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedExceptions = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  function selectDate(dateKey: string) {
    setSelectedDate((prev) => (prev === dateKey ? null : dateKey));
    setError(null);
    setStartTime("");
    setEndTime("");
    setReason("");
    setType("available");
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!selectedDate) return;
    setError(null);
    if (type === "available" && (!startTime || !endTime)) {
      setError("Укажите время начала и окончания слота");
      return;
    }
    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError("Время начала и окончания нужно указывать вместе");
      return;
    }
    setSubmitting(true);
    try {
      await onAdd({
        date: selectedDate,
        type,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        capacity: type === "available" ? Number(capacity) || 1 : undefined,
        reason: reason || undefined,
      });
      setStartTime("");
      setEndTime("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await onRemove(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-full px-2 py-1 hover:bg-black/[.04] dark:hover:bg-white/[.08]"
        >
          ←
        </button>
        <span className="font-medium">
          {MONTH_LABELS[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-full px-2 py-1 hover:bg-black/[.04] dark:hover:bg-white/[.08]"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} />;
          const dateKey = toDateKey(year, month, day);
          const dayExceptions = byDate.get(dateKey) ?? [];
          const isSelected = selectedDate === dateKey;
          const hasAvailable = dayExceptions.some((e) => e.type === "available");
          const hasBlock = dayExceptions.some((e) => e.type === "block");
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDate(dateKey)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                isSelected
                  ? "bg-accent text-white"
                  : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"
              }`}
            >
              <span>{day}</span>
              {(hasAvailable || hasBlock) && (
                <span className="mt-0.5 flex gap-0.5">
                  {hasAvailable && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  {hasBlock && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
          <p className="text-sm font-medium">{selectedDate}</p>

          {selectedExceptions.length > 0 && (
            <ul className="flex flex-col gap-2">
              {selectedExceptions.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                >
                  <span>
                    {ex.type === "available" ? (
                      <>
                        Открыт слот {ex.startTime?.slice(0, 5)}–{ex.endTime?.slice(0, 5)}, до{" "}
                        {ex.capacity} чел.
                      </>
                    ) : (
                      <>
                        Блокировка{" "}
                        {ex.startTime
                          ? `${ex.startTime.slice(0, 5)}–${ex.endTime?.slice(0, 5)}`
                          : "весь день"}
                      </>
                    )}
                    {ex.reason && <span className="text-zinc-500"> — {ex.reason}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(ex.id)}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="flex flex-col gap-2 text-sm">
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={type === "available"}
                  onChange={() => setType("available")}
                />
                Открыть слот
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={type === "block"}
                  onChange={() => setType("block")}
                />
                Заблокировать
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input w-28"
              />
              <span>—</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input w-28"
              />
            </div>
            {type === "block" && (
              <p className="text-xs text-zinc-500">
                Оставьте оба поля пустыми, чтобы заблокировать весь день
              </p>
            )}

            {type === "available" && (
              <label className="flex flex-col gap-1">
                <span className="text-zinc-600 dark:text-zinc-400">Вместимость (человек)</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="input w-28"
                />
              </label>
            )}

            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="input"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="self-start rounded-full border border-black/10 px-4 py-2 hover:bg-black/[.04] disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[.08]"
            >
              {submitting
                ? "Сохраняем…"
                : type === "available"
                  ? "Открыть слот на эту дату"
                  : "Заблокировать"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
