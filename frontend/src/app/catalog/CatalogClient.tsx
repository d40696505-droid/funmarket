"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ServiceCard } from "@/components/ServiceCard";
import { CITIES } from "@/lib/cities";
import {
  getCategories,
  searchServices,
  type Category,
  type SearchServicesParams,
  type SearchServicesResult,
} from "@/lib/api";

const RADIUS_OPTIONS = [1, 5, 10, 25, 50];

// Все фильтры и номер страницы живут в URL (?q=&categoryId=&page= и т.д.),
// а не в локальном useState. Раньше при переходе в карточку услуги и
// возврате назад каталог перемонтировался с исходным URL (обычно голым
// /catalog), а локальное состояние сбрасывалось на дефолты — фильтр и
// страница терялись (баги "фильтр сбрасывается" / "назад -> первая
// страница"). URL-параметры браузер восстанавливает сам при навигации
// назад, поэтому источник истины перенесён туда.
export function CatalogClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const priceMin = searchParams.get("priceMin") ?? "";
  const priceMax = searchParams.get("priceMax") ?? "";
  const city = searchParams.get("city") ?? "";
  const sortBy = (searchParams.get("sortBy") as SearchServicesParams["sortBy"]) || "newest";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const near = latParam && lngParam ? { lat: Number(latParam), lng: Number(lngParam) } : null;
  const radiusKm = Number(searchParams.get("radiusKm") ?? 10);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<SearchServicesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Меняет URL-параметры каталога поверх текущих (не полная перезапись —
  // остальные фильтры сохраняются). replace, не push: правки фильтров не
  // должны плодить отдельные записи в истории браузера — иначе "назад" из
  // карточки услуги приходилось бы жать по многу раз, чтобы выйти из
  // каталога. resetPage=true — смена любого фильтра, кроме самой пагинации,
  // возвращает на первую страницу (иначе легко попасть на пустую страницу
  // N при меньшем результате).
  function updateParams(patch: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (resetPage) params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const params: SearchServicesParams = {
      q: q || undefined,
      categoryId: categoryId || undefined,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      city: city || undefined,
      sortBy,
      lat: near?.lat,
      lng: near?.lng,
      radiusKm: near ? radiusKm : undefined,
      page,
      limit: 20,
    };
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => searchServices(params))
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryId, priceMin, priceMax, city, sortBy, near?.lat, near?.lng, radiusKm, page]);

  function handleFindNearMe() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Геолокация не поддерживается браузером");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateParams({
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
          radiusKm: String(radiusKm),
        });
      },
      () => setGeoError("Не удалось определить местоположение"),
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  // max-w-7xl — как у шапки (Header.tsx) и остальных страниц с карточками
  // (главная, избранное, подписки, профиль продавца). Раньше здесь стоял
  // max-w-5xl — на 128px уже, из-за чего левый/правый край каталога не
  // совпадал с шапкой на широких экранах.
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Каталог услуг</h1>
        <Link href="/map" className="text-sm underline">
          Смотреть на карте
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => updateParams({ q: e.target.value })}
          placeholder="Поиск..."
          className="input min-w-[200px] flex-1"
        />
        <select
          value={categoryId}
          onChange={(e) => updateParams({ categoryId: e.target.value })}
          className="input"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={priceMin}
          onChange={(e) => updateParams({ priceMin: e.target.value })}
          type="number"
          placeholder="Цена от"
          className="input w-28"
        />
        <input
          value={priceMax}
          onChange={(e) => updateParams({ priceMax: e.target.value })}
          type="number"
          placeholder="Цена до"
          className="input w-28"
        />
        <select
          value={city}
          onChange={(e) => updateParams({ city: e.target.value })}
          className="input"
        >
          <option value="">Все города</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => updateParams({ sortBy: e.target.value })}
          className="input"
        >
          <option value="newest">Сначала новые</option>
          <option value="price">По цене</option>
          <option value="rating">По рейтингу</option>
          {near && <option value="distance">По расстоянию</option>}
        </select>
        <button
          type="button"
          onClick={handleFindNearMe}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          {near ? "Рядом со мной ✓" : "Рядом со мной"}
        </button>
        {near && (
          <select
            value={radiusKm}
            onChange={(e) => updateParams({ radiusKm: e.target.value })}
            className="input"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} км
              </option>
            ))}
          </select>
        )}
      </div>
      {geoError && <p className="mb-4 text-sm text-red-600">{geoError}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : !result || result.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Ничего не найдено</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {result.items.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) }, false)}
                className="disabled:opacity-40"
              >
                ← Назад
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) }, false)}
                className="disabled:opacity-40"
              >
                Вперёд →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
