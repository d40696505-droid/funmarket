"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceCard } from "@/components/ServiceCard";
import { getFavorites, type Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const { ids } = useFavorites();
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function reload() {
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => getFavorites())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) reload();
  }, [user, ids]);

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Избранное</h1>

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Пока пусто — добавляйте услуги в избранное сердечком на карточке.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </main>
  );
}
