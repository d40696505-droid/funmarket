"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBooking,
  confirmBooking,
  getMyBookings,
  rejectBooking,
  type Booking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const STATUS_LABEL: Record<Booking["status"], string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждён",
  awaiting_payment: "Ожидает оплаты",
  rejected: "Отклонён",
  cancelled: "Отменён",
  paid: "Оплачен",
  completed: "Завершён",
  disputed: "Спор",
};

const STATUS_COLOR: Record<Booking["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  awaiting_payment: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  disputed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function IncomingOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fixedAmountDrafts, setFixedAmountDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function reload() {
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => getMyBookings({ as: "seller" }))
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) reload();
  }, [user]);

  async function handleConfirm(id: string, fixedAmount?: string) {
    setActionError(null);
    try {
      await confirmBooking(id, fixedAmount);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось подтвердить");
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Причина отклонения:");
    if (!reason) return;
    setActionError(null);
    try {
      await rejectBooking(id, reason);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отклонить");
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Отменить подтверждённый заказ?")) return;
    setActionError(null);
    try {
      await cancelBooking(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отменить");
    }
  }

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Входящие заказы</h1>

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет заказов</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/services/${booking.serviceId}`}
                    className="font-medium hover:underline"
                  >
                    {booking.service?.title ?? "Услуга"}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[booking.status]}`}>
                    {STATUS_LABEL[booking.status]}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">
                  {booking.bookingDate} {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
                  {booking.buyer && ` · ${booking.buyer.firstName ?? booking.buyer.email}`}
                </p>
                {booking.comment && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    «{booking.comment}»
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                {booking.status === "pending" && booking.totalAmount === null && (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={fixedAmountDrafts[booking.id] ?? ""}
                      onChange={(e) =>
                        setFixedAmountDrafts((prev) => ({ ...prev, [booking.id]: e.target.value }))
                      }
                      placeholder="Сумма, ₽"
                      className="input w-28 py-1 text-sm"
                    />
                    <button
                      onClick={() => handleConfirm(booking.id, fixedAmountDrafts[booking.id])}
                      disabled={!fixedAmountDrafts[booking.id]}
                      className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[.08]"
                    >
                      Подтвердить с ценой
                    </button>
                    <button
                      onClick={() => handleReject(booking.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      Отклонить
                    </button>
                  </>
                )}
                {booking.status === "pending" && booking.totalAmount !== null && (
                  <>
                    <button
                      onClick={() => handleConfirm(booking.id)}
                      className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                    >
                      Подтвердить
                    </button>
                    <button
                      onClick={() => handleReject(booking.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      Отклонить
                    </button>
                  </>
                )}
                {booking.status === "awaiting_payment" && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
