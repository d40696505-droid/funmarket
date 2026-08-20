"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPayoutHistory,
  getSellerBalance,
  type SellerBalance,
  type Transaction,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const TX_STATUS_LABEL: Record<Transaction["status"], string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачено, ожидает релиза",
  released: "Выплачено",
  refunded: "Возвращено",
  failed: "Не завершено",
};

export default function SellerBalancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && user.role !== "seller" && user.role !== "both") {
      router.push("/profile");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || (user.role !== "seller" && user.role !== "both")) return;
    Promise.all([getSellerBalance(), getPayoutHistory()])
      .then(([b, p]) => {
        setBalance(b);
        setPayouts(p);
      })
      .catch(() => {
        setBalance(null);
        setPayouts([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user || loading) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/profile" className="mb-4 inline-block text-sm text-zinc-500 hover:underline">
        ← Профиль
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Баланс и выплаты</h1>

      {!user.isSellerVerified && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Аккаунт не верифицирован — выплаты по оплаченным заказам будут зачислены после
          прохождения верификации администратором.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-sm text-zinc-500">Доступно</p>
          <p className="text-2xl font-semibold">
            {Number(balance?.available ?? 0).toLocaleString("ru-RU")} ₽
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-zinc-500">Ожидает релиза</p>
          <p className="text-2xl font-semibold">
            {Number(balance?.pending ?? 0).toLocaleString("ru-RU")} ₽
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-medium">История выплат</h2>
      {payouts.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет оплаченных заказов</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {payouts.map((tx) => (
            <li key={tx.id} className="card flex items-center justify-between gap-2 p-4">
              <div>
                <p className="font-medium">{tx.booking?.service?.title ?? "Услуга"}</p>
                <p className="text-sm text-zinc-500">
                  {new Date(tx.createdAt).toLocaleDateString("ru-RU")} · {TX_STATUS_LABEL[tx.status]}
                </p>
              </div>
              <p className="font-medium">
                {Number(tx.sellerPayoutAmount).toLocaleString("ru-RU")} ₽
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
