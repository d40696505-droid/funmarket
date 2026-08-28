"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

export function CatalogClient() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<SearchServicesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [city, setCity] = useState("");
  const [sortBy, setSortBy] = useState<SearchServicesParams["sortBy"]>("newest");
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [page, setPage] = useState(1);

  // Подхватывает ?q=/?categoryId=/?city=/?lat=&lng=&radiusKm= из ссылки
  // (поиск и город в шапке, «рядом со мной», карусели категорий на
  // главной) — не в useEffect (React-паттерн "adjusting state when a prop
  // changes", react.dev), а прямо в теле рендера под сравнением с
  // последним увиденным searchParams. На одном lazy useState-инициализаторе
  // это ломалось: переход на /catalog?city=X, уже находясь на /catalog, не
  // перемонтирует компонент, и инициализатор второй раз не выполняется —
  // фильтр молча оставался старым.
  const [lastParams, setLastParams] = useState(searchParams.toString());
  if (searchParams.toString() !== lastParams) {
    setLastParams(searchParams.toString());
    setQ(searchParams.get("q") ?? "");
    setCategoryId(searchParams.get("categoryId") ?? "");
    setCity(searchParams.get("city") ?? "");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat && lng) {
      setNear({ lat: Number(lat), lng: Number(lng) });
      const radius = searchParams.get("radiusKm");
      if (radius) setRadiusKm(Number(radius));
    }
    setPage(1);
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
  }, [q, categoryId, priceMin, priceMax, city, sortBy, near, radiusKm, page]);

  function handleFindNearMe() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Геолокация не поддерживается браузером");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPage(1);
      },
      () => setGeoError("Не удалось определить местоположение"),
    );
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Каталог услуг</h1>
        <Link href="/map" className="text-sm underline">
          Смотреть на карте
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Поиск..."
          className="input min-w-[200px] flex-1"
        />
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setPriceMin(e.target.value);
            setPage(1);
          }}
          type="number"
          placeholder="Цена от"
          className="input w-28"
        />
        <input
          value={priceMax}
          onChange={(e) => {
            setPriceMax(e.target.value);
            setPage(1);
          }}
          type="number"
          placeholder="Цена до"
          className="input w-28"
        />
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setSortBy(e.target.value as SearchServicesParams["sortBy"]);
            setPage(1);
          }}
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
            onChange={(e) => setRadiusKm(Number(e.target.value))}
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
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
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
