"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveService,
  getModerationQueue,
  getSellersForVerification,
  rejectServiceModeration,
  verifySeller,
  type PublicUser,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"moderation" | "sellers">("moderation");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  function reloadServices() {
    Promise.resolve()
      .then(() => setServicesLoading(true))
      .then(() => getModerationQueue())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }

  function reloadSellers() {
    Promise.resolve()
      .then(() => setSellersLoading(true))
      .then(() => getSellersForVerification())
      .then(setSellers)
      .catch(() => setSellers([]))
      .finally(() => setSellersLoading(false));
  }

  useEffect(() => {
    if (!user?.isAdmin) return;
    reloadServices();
    reloadSellers();
  }, [user]);

  async function handleApprove(id: string) {
    setError(null);
    try {
      await approveService(id);
      reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить");
    }
  }

  async function handleReject(id: string) {
    const comment = prompt("Причина отклонения:");
    if (!comment) return;
    setError(null);
    try {
      await rejectServiceModeration(id, comment);
      reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить");
    }
  }

  async function handleToggleVerify(userId: string, verified: boolean) {
    setError(null);
    try {
      await verifySeller(userId, verified);
      reloadSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить верификацию");
    }
  }

  if (authLoading || !user || !user.isAdmin) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Администрирование</h1>

      <div className="mb-6 flex gap-1 rounded-full border border-black/10 p-0.5 text-sm dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setTab("moderation")}
          className={`rounded-full px-3 py-1 ${tab === "moderation" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
        >
          Модерация услуг
        </button>
        <button
          type="button"
          onClick={() => setTab("sellers")}
          className={`rounded-full px-3 py-1 ${tab === "sellers" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
        >
          Верификация продавцов
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tab === "moderation" &&
        (servicesLoading ? (
          <p className="text-sm text-zinc-500">Загрузка…</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-zinc-500">Нет услуг на модерации</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {services.map((service) => (
              <li key={service.id} className="card flex flex-col gap-2 p-4">
                <div>
                  <p className="font-medium">{service.title}</p>
                  <p className="text-sm text-zinc-500">
                    {service.seller?.firstName ?? service.seller?.email ?? "Продавец"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {service.description}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => handleApprove(service.id)}
                    className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Одобрить
                  </button>
                  <button
                    onClick={() => handleReject(service.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  >
                    Отклонить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === "sellers" &&
        (sellersLoading ? (
          <p className="text-sm text-zinc-500">Загрузка…</p>
        ) : sellers.length === 0 ? (
          <p className="text-sm text-zinc-500">Нет продавцов</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sellers.map((seller) => (
              <li
                key={seller.id}
                className="card flex items-center justify-between gap-2 p-4"
              >
                <div>
                  <p className="font-medium">
                    {seller.brandName || [seller.firstName, seller.lastName].filter(Boolean).join(" ") || seller.email}
                  </p>
                  <p className="text-sm text-zinc-500">{seller.email}</p>
                  <p className="mt-1 text-sm">
                    {seller.isSellerVerified ? (
                      <span className="text-accent">Верифицирован</span>
                    ) : (
                      <span className="text-zinc-500">Не верифицирован</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleVerify(seller.id, !seller.isSellerVerified)}
                  className={
                    seller.isSellerVerified
                      ? "rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      : "btn-primary px-3.5 py-1.5 text-sm"
                  }
                >
                  {seller.isSellerVerified ? "Снять верификацию" : "Верифицировать"}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
