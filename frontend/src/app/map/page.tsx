"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ServiceMap } from "@/components/ServiceMap";
import {
  getCategories,
  getServiceMapMarkers,
  type Category,
  type ServiceMapMarker,
} from "@/lib/api";

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
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                  ★ {selected.sellerRating.toFixed(1)}
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-zinc-500 dark:border-white/15">
            Выберите точку на карте
          </p>
        )}

        <ul className="flex flex-col gap-1 overflow-y-auto lg:max-h-[calc(100vh-260px)]">
          {markers.map((marker) => (
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
      </aside>

      <ServiceMap
        markers={markers}
        onMarkerClick={setSelected}
        highlightedId={hoveredId}
        onMarkerHover={handleMarkerHover}
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
            <span className="line-clamp-2 text-sm leading-snug font-medium text-zinc-900">
              {hoverPreview.marker.title}
            </span>
            <span className="text-xs text-zinc-600">{formatPrice(hoverPreview.marker)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
