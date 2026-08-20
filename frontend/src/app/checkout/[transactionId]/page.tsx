"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  cancelCheckout,
  getTransaction,
  simulatePayment,
  type Transaction,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ transactionId: string }>();
  const transactionId = params.transactionId;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    getTransaction(transactionId)
      .then(setTransaction)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить оплату"))
      .finally(() => setLoading(false));
  }, [transactionId, user]);

  async function handlePay() {
    setProcessing(true);
    setError(null);
    try {
      const updated = await simulatePayment(transactionId);
      setTransaction(updated);
      router.push("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось провести оплату");
      setProcessing(false);
    }
  }

  async function handleCancel() {
    setProcessing(true);
    setError(null);
    try {
      await cancelCheckout(transactionId);
      router.push("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить оплату");
      setProcessing(false);
    }
  }

  if (authLoading || !user || loading) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  if (error && !transaction) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/orders" className="mt-4 inline-block text-sm text-accent hover:underline">
          Вернуться к заказам
        </Link>
      </main>
    );
  }

  if (!transaction) return null;

  const booking = transaction.booking;
  const isPending = transaction.status === "pending";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Оплата заказа</h1>

      <div className="card flex flex-col gap-3 p-5">
        {booking?.service && (
          <div>
            <p className="text-sm text-zinc-500">Услуга</p>
            <p className="font-medium">{booking.service.title}</p>
          </div>
        )}
        {booking && (
          <div>
            <p className="text-sm text-zinc-500">Дата и время</p>
            <p className="font-medium">
              {booking.bookingDate} {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
            </p>
          </div>
        )}

        <div className="border-t border-black/10 pt-3 dark:border-white/10">
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>Сумма заказа</span>
            <span>{Number(transaction.amount).toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>Комиссия платформы</span>
            <span>{Number(transaction.commissionAmount).toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="mt-1 flex items-center justify-between font-medium">
            <span>К оплате</span>
            <span>{Number(transaction.amount).toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>

        {!isPending && (
          <p className="text-sm text-zinc-500">
            Эта оплата уже обработана (статус: {transaction.status}).
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isPending && (
          <div className="flex gap-2 pt-2">
            <button onClick={handlePay} disabled={processing} className="btn-primary flex-1">
              {processing ? "Обработка…" : "Оплатить"}
            </button>
            <button onClick={handleCancel} disabled={processing} className="btn-secondary flex-1">
              Отменить
            </button>
          </div>
        )}

        {!isPending && (
          <Link href="/orders" className="btn-secondary text-center">
            К заказам
          </Link>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Тестовый режим оплаты — реальное списание средств не происходит.
      </p>
    </main>
  );
}
