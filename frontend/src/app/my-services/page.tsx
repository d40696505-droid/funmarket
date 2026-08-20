"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  activateService,
  deactivateService,
  deleteService,
  getMyServices,
  submitServiceForModeration,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SERVICE_STATUS_COLOR as STATUS_COLOR, SERVICE_STATUS_LABEL as STATUS_LABEL } from "@/lib/service-status";

export default function MyServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function reload() {
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => getMyServices())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) reload();
  }, [user]);

  async function handleAction(action: () => Promise<Service>) {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Действие не выполнено");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить объявление?")) return;
    setActionError(null);
    try {
      await deleteService(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось удалить");
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои услуги</h1>
        <Link
          href="/my-services/new"
          className="btn-primary px-4 py-2"
        >
          + Создать
        </Link>
      </div>

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет объявлений</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li
              key={service.id}
              className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/my-services/${service.id}`} className="font-medium hover:underline">
                    {service.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[service.status]}`}
                  >
                    {STATUS_LABEL[service.status]}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">
                  {service.viewsCount} просмотров · {service.bookingsCount} бронирований
                </p>
                {service.status === "draft" && service.moderationComment && (
                  <p className="mt-1 text-sm text-red-600">
                    Отклонено: {service.moderationComment}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                {(service.status === "draft" || service.status === "inactive") && (
                  <button
                    onClick={() => handleAction(() => submitServiceForModeration(service.id))}
                    className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    На модерацию
                  </button>
                )}
                {service.status === "active" && (
                  <button
                    onClick={() => handleAction(() => deactivateService(service.id))}
                    className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Деактивировать
                  </button>
                )}
                {service.status === "inactive" && (
                  <button
                    onClick={() => handleAction(() => activateService(service.id))}
                    className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Активировать
                  </button>
                )}
                <Link
                  href={`/my-services/${service.id}`}
                  className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                >
                  Редактировать
                </Link>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
