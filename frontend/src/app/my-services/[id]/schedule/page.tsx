"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addScheduleException,
  getMySchedule,
  getMyServiceById,
  getMyExceptions,
  removeScheduleException,
  replaceSchedule,
  type ScheduleEntry,
  type ScheduleExceptionItem,
  type ScheduleExceptionType,
} from "@/lib/api";
import { ScheduleExceptionCalendar } from "@/components/ScheduleExceptionCalendar";
import { useAuth } from "@/lib/auth-context";

const DAYS = [
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
  { value: 0, label: "Воскресенье" },
];

interface DayRow {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export default function SellerSchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const serviceId = params.id;

  const [days, setDays] = useState<Record<number, DayRow>>(() =>
    Object.fromEntries(
      DAYS.map((d) => [d.value, { enabled: false, startTime: "09:00", endTime: "18:00" }]),
    ),
  );
  const [exceptions, setExceptions] = useState<ScheduleExceptionItem[]>([]);
  const [defaultCapacity, setDefaultCapacity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    Promise.all([getMySchedule(), getMyExceptions(), getMyServiceById(serviceId)])
      .then(([schedule, exceptionList, service]: [
        ScheduleEntry[],
        ScheduleExceptionItem[],
        Awaited<ReturnType<typeof getMyServiceById>>,
      ]) => {
        setDays((prev) => {
          const next = { ...prev };
          for (const entry of schedule) {
            next[entry.dayOfWeek] = {
              enabled: true,
              startTime: entry.startTime.slice(0, 5),
              endTime: entry.endTime.slice(0, 5),
            };
          }
          return next;
        });
        setExceptions(exceptionList);
        setDefaultCapacity(service.capacity);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serviceId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const entries = Object.entries(days)
        .filter(([, row]) => row.enabled)
        .map(([dayOfWeek, row]) => ({
          dayOfWeek: Number(dayOfWeek),
          startTime: row.startTime,
          endTime: row.endTime,
        }));
      await replaceSchedule(entries);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить расписание");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddException(data: {
    date: string;
    type: ScheduleExceptionType;
    startTime?: string;
    endTime?: string;
    capacity?: number;
    reason?: string;
  }) {
    const created = await addScheduleException(data);
    setExceptions((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
  }

  async function handleRemoveException(id: string) {
    await removeScheduleException(id);
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  if (authLoading || loading || !user) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Расписание</h1>

      <form onSubmit={handleSave} className="mb-10 flex flex-col gap-3">
        {DAYS.map((day) => {
          const row = days[day.value];
          return (
            <div key={day.value} className="flex items-center gap-3 text-sm">
              <label className="flex w-36 items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) =>
                    setDays((prev) => ({
                      ...prev,
                      [day.value]: { ...prev[day.value], enabled: e.target.checked },
                    }))
                  }
                />
                {day.label}
              </label>
              <input
                type="time"
                value={row.startTime}
                disabled={!row.enabled}
                onChange={(e) =>
                  setDays((prev) => ({
                    ...prev,
                    [day.value]: { ...prev[day.value], startTime: e.target.value },
                  }))
                }
                className="input w-28 disabled:opacity-40"
              />
              <span>—</span>
              <input
                type="time"
                value={row.endTime}
                disabled={!row.enabled}
                onChange={(e) =>
                  setDays((prev) => ({
                    ...prev,
                    [day.value]: { ...prev[day.value], endTime: e.target.value },
                  }))
                }
                className="input w-28 disabled:opacity-40"
              />
            </div>
          );
        })}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Сохранено</p>}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary mt-2 self-start"
        >
          {saving ? "Сохраняем…" : "Сохранить расписание"}
        </button>
      </form>

      <h2 className="mb-1 text-lg font-medium">Разовые изменения расписания</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Кликните по дате в календаре, чтобы заблокировать её или открыть разовый слот вне
        обычного графика (например, если готовы провести мероприятие в день, когда обычно не
        работаете).
      </p>
      <ScheduleExceptionCalendar
        exceptions={exceptions}
        defaultCapacity={defaultCapacity}
        onAdd={handleAddException}
        onRemove={handleRemoveException}
      />
    </main>
  );
}
