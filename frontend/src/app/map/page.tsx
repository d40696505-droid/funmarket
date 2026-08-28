"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ServiceMap } from "@/components/ServiceMap";
import {
  getCategories,
  getServiceMapMarkers,
  type Category,
  type ServiceMapMarker,
} from "@/lib/api";
import { haversineDistanceKm } from "@/lib/geo";

const VISIBLE_COUNT = 5;

function formatPrice(marker: ServiceMapMarker): string {
  if (marker.priceType === "negotiable" || marker.priceMin == null) {
    return "По договорённости";
  }
  return `от ${marker.priceMin.toLocaleString("ru-RU")} ₽`;
}

export default function MapPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [markers, setMarkers] = useState<ServiceMapMarker[]>([]);
  const [selected, setSelected] = useState<ServiceMapMarker | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Наведение на строку списка → подсветка точки на карте.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Наведение на саму точку карты → всплывающее превью услуги у курсора.
  const [hoverPreview, setHoverPreview] = useState<{
    marker: ServiceMapMarker;
    x: number;
    y: number;
  } | null>(null);
  // Тихий запрос геолокации при открытии страницы — если разрешат,
  // список слева сортируется по расстоянию; если нет/откажут — список
  // остаётся как есть, без сортировки и сворачивания.
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
    );
  }, []);

  const sortedMarkers = useMemo(() => {
    if (!userPos) return markers;
    return [...markers].sort(
      (a, b) =>
        haversineDistanceKm(userPos.lat, userPos.lng, a.lat, a.lng) -
        haversineDistanceKm(userPos.lat, userPos.lng, b.lat, b.lng),
    );
  }, [markers, userPos]);

  const visibleMarkers =
    userPos && !expanded ? sortedMarkers.slice(0, VISIBLE_COUNT) : sortedMarkers;
  const hiddenMarkers = userPos && !expanded ? sortedMarkers.slice(VISIBLE_COUNT) : [];
  const maxHiddenDistanceKm =
    hiddenMarkers.length > 0
      ? Math.ceil(
          Math.max(
            ...hiddenMarkers.map((m) =>
              haversineDistanceKm(userPos!.lat, userPos!.lng, m.lat, m.lng),
            ),
          ),
        )
      : 0;

  // useCallback — стабильная ссылка, иначе ServiceMap пересобирал бы всю
  // карту (эффект зависит от onMarkerHover) при каждом наведении.
  const handleMarkerHover = useCallback(
    (marker: ServiceMapMarker | null, position: { x: number; y: number } | null) => {
      if (!marker || !position) {
        setHoverPreview(null);
        return;
      }
      // Прижимаем превью к краю экрана, если курсор у самой границы —
      // иначе карточка (≈230×90px) частично обрезается вьюпортом.
      const x = Math.min(position.x, window.innerWidth - 240);
      const y = Math.min(position.y, window.innerHeight - 100);
      setHoverPreview({ marker, x, y });
    },
    [],
  );

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    getServiceMapMarkers({ categoryId: categoryId || undefined })
      .then((data) => {
        setMarkers(data);
        setSelected(null);
        setExpanded(false);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Не удалось загрузить услуги"));
  }, [categoryId]);

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col gap-3 border-b border-black/10 p-4 dark:border-white/10 lg:w-1/5 lg:min-w-[280px] lg:border-b-0 lg:border-r">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="input"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {selected ? (
          <Link href={`/services/${selected.id}`} className="card flex flex-col overflow-hidden">
            <div className="relative aspect-[4/3] w-full bg-black/5 dark:bg-white/10">
              {selected.previewUrl && (
                <Image
                  src={selected.previewUrl}
                  alt={selected.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-col gap-1 p-3">
              <span className="text-xs text-zinc-500">{selected.categoryName}</span>
              <h3 className="line-clamp-2 font-medium leading-snug">{selected.title}</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{formatPrice(selected)}</span>
                {selected.sellerReviewsCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    <span className="text-accent">★</span>
                    <span className="font-medium">{selected.sellerRating.toFixed(1)}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      ({selected.sellerReviewsCount})
                    </span>
                  </span>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-zinc-500 dark:border-white/15">
            Выберите точку на карте
          </p>
        )}

        <ul className="flex flex-col gap-1 overflow-y-auto lg:max-h-[calc(100vh-260px)]">
          {visibleMarkers.map((marker) => (
            <li key={marker.id}>
              <button
                type="button"
                onClick={() => setSelected(marker)}
                onMouseEnter={() => setHoveredId(marker.id)}
                onMouseLeave={() => setHoveredId((id) => (id === marker.id ? null : id))}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.08] ${
                  selected?.id === marker.id ? "bg-black/[.06] dark:bg-white/[.1]" : ""
                }`}
              >
                <span className="line-clamp-1 flex-1">{marker.title}</span>
                <span className="shrink-0 text-xs text-zinc-500">{formatPrice(marker)}</span>
              </button>
            </li>
          ))}
        </ul>

        {hiddenMarkers.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg px-2 py-1.5 text-left text-sm text-accent-dark hover:underline"
          >
            Ещё {hiddenMarkers.length} в пределах {maxHiddenDistanceKm} км от вас
          </button>
        )}
      </aside>

      <ServiceMap
        markers={markers}
        onMarkerClick={setSelected}
        highlightedId={hoveredId}
        onMarkerHover={handleMarkerHover}
        focusedId={selected?.id ?? null}
        className="min-h-[400px] flex-1"
      />

      {hoverPreview && (
        <div
          className="card-glass pointer-events-none fixed z-30 flex w-56 gap-2.5 p-2.5"
          style={{ left: hoverPreview.x + 16, top: hoverPreview.y + 16 }}
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/5">
            {hoverPreview.marker.previewUrl && (
              <Image
                src={hoverPreview.marker.previewUrl}
                alt={hoverPreview.marker.title}
                fill
                unoptimized
                className="object-cover"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-0.5">
            <span className="line-clamp-2 text-sm leading-snug font-medium">
              {hoverPreview.marker.title}
            </span>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{formatPrice(hoverPreview.marker)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
