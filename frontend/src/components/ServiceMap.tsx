"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ServiceMapMarker } from "@/lib/api";
import { useYandexMaps, type YandexClusterer, type YandexMap, type YandexPlacemark } from "@/lib/use-yandex-maps";

const DEFAULT_CENTER: [number, number] = [55.751244, 37.618423]; // Москва
const DEFAULT_PRESET = "islands#violetDotIcon";
const HIGHLIGHT_PRESET = "islands#redDotIcon";

export function ServiceMap({
  markers,
  className,
  center = DEFAULT_CENTER,
  zoom = 10,
  onMarkerClick,
  highlightedId,
  onMarkerHover,
}: {
  markers: ServiceMapMarker[];
  className?: string;
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (marker: ServiceMapMarker) => void;
  // id услуги, чей маркер нужно подсветить (наведение на строку в списке).
  highlightedId?: string | null;
  // Наведение на сам маркер — координаты курсора нужны, чтобы показать
  // превью-карточку рядом с ним (position: fixed на стороне вызывающего).
  onMarkerHover?: (marker: ServiceMapMarker | null, position: { x: number; y: number } | null) => void;
}) {
  const { ready, error: mapError } = useYandexMaps();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YandexMap | null>(null);
  const placemarksRef = useRef<Map<string, YandexPlacemark>>(new Map());

  // Один эффект вместо двух: создание карты и добавление меток должны
  // синхронно зависеть друг от друга. При раздельных эффектах (создание
  // карты по [ready], метки по [markers]) метки могли добавляться раньше,
  // чем существует карта, и не перерисовывались повторно — так было на
  // главной, где markers приходит стабильным пропом с сервера.
  useEffect(() => {
    if (!ready || !mapContainerRef.current || !window.ymaps) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.ymaps.Map(mapContainerRef.current, {
        center,
        zoom,
        controls: ["zoomControl", "geolocationControl"],
      });
    }
    const map = mapInstanceRef.current;

    map.geoObjects.removeAll();
    placemarksRef.current.clear();
    if (markers.length === 0) return;

    const clusterer: YandexClusterer = new window.ymaps.Clusterer({
      preset: "islands#invertedVioletClusterIcons",
      groupByCoordinates: false,
    });

    const placemarks = markers.map((marker) => {
      const priceLabel =
        marker.priceType === "negotiable" || marker.priceMin == null
          ? "по договорённости"
          : `от ${marker.priceMin.toLocaleString("ru-RU")} ₽`;

      const placemark = new window.ymaps!.Placemark(
        [marker.lat, marker.lng],
        {
          hintContent: `${marker.title} — ${priceLabel}`,
        },
        { preset: marker.id === highlightedId ? HIGHLIGHT_PRESET : DEFAULT_PRESET },
      );
      placemark.events.add("click", () =>
        onMarkerClick ? onMarkerClick(marker) : router.push(`/services/${marker.id}`),
      );
      placemark.events.add("mouseenter", (e) => {
        const domEvent = e.get("domEvent") as { get: (key: string) => unknown } | undefined;
        const x = domEvent?.get("clientX");
        const y = domEvent?.get("clientY");
        onMarkerHover?.(
          marker,
          typeof x === "number" && typeof y === "number" ? { x, y } : null,
        );
      });
      placemark.events.add("mouseleave", () => onMarkerHover?.(null, null));
      placemarksRef.current.set(marker.id, placemark);
      return placemark;
    });

    clusterer.add(placemarks);
    map.geoObjects.add(clusterer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, router, onMarkerClick, onMarkerHover]);

  // Подсветка маркера при наведении на строку списка — меняем preset уже
  // созданных placemark'ов напрямую, без пересборки кластеризатора.
  useEffect(() => {
    for (const [id, placemark] of placemarksRef.current) {
      placemark.options.set("preset", id === highlightedId ? HIGHLIGHT_PRESET : DEFAULT_PRESET);
    }
  }, [highlightedId]);

  return (
    <div className={className}>
      {mapError && <p className="p-4 text-sm text-red-600">{mapError}</p>}
      <div ref={mapContainerRef} className="h-full min-h-[400px] w-full" />
    </div>
  );
}
