"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Booking } from "@/lib/api";
import { STATUS_COLOR, STATUS_DOT_COLOR, STATUS_LABEL } from "@/lib/booking-status";

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

export function BookingsCalendar({ bookings }: { bookings: Booking[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.bookingDate) ?? [];
      list.push(booking);
      map.set(booking.bookingDate, list);
    }
    return map;
  }, [bookings]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = mondayFirst(new Date(year, month, 1).getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedBookings = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

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
          const dayBookings = byDate.get(dateKey) ?? [];
          const isSelected = selectedDate === dateKey;
          const visibleBookings = dayBookings.slice(0, 2);
          const hiddenCount = dayBookings.length - visibleBookings.length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : dateKey)}
              className={`flex min-h-[88px] flex-col items-stretch gap-0.5 rounded-lg p-1 text-left text-sm transition-colors sm:min-h-[104px] ${
                isSelected
                  ? "bg-accent text-white"
                  : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"
              }`}
            >
              <span className="px-0.5">{day}</span>
              {visibleBookings.map((b) => (
                <span
                  key={b.id}
                  className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                    isSelected ? "bg-white/20" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLOR[b.status]}`}
                  />
                  <span className="truncate">
                    {b.startTime.slice(0, 5)} {b.service?.title ?? "Услуга"}
                  </span>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className={`px-1 text-[10px] ${isSelected ? "text-white/80" : "text-zinc-500"}`}>
                  +{hiddenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
          <p className="text-sm font-medium">{selectedDate}</p>
          {selectedBookings.length === 0 ? (
            <p className="text-sm text-zinc-500">Нет заказов на этот день</p>
          ) : (
            selectedBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/services/${booking.serviceId}`}
                className="card flex items-center justify-between p-3 text-sm"
              >
                <span>
                  {booking.service?.title ?? "Услуга"} · {booking.startTime.slice(0, 5)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[booking.status]}`}>
                  {STATUS_LABEL[booking.status]}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
