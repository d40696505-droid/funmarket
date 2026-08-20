"use client";

import { useState } from "react";
import { ServiceMap } from "@/components/ServiceMap";
import type { Service, ServiceMapMarker } from "@/lib/api";
import { haversineDistanceKm } from "@/lib/geo";

export function ServiceLocationWidget({ service }: { service: Service }) {
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (!service.locationPoint) return null;

  const [lng, lat] = service.locationPoint.coordinates;
  const marker: ServiceMapMarker = {
    id: service.id,
    title: service.title,
    priceMin: service.priceMin != null ? Number(service.priceMin) : null,
    priceType: service.priceType,
    categoryName: service.category?.name ?? "",
    sellerRating: service.seller ? Number(service.seller.rating) : 0,
    previewUrl: service.images[0]?.url ?? null,
    lat,
    lng,
  };

  function handleShowDistance() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Геолокация не поддерживается браузером");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDistanceKm(haversineDistanceKm(pos.coords.latitude, pos.coords.longitude, lat, lng));
        setLocating(false);
      },
      () => {
        setGeoError("Не удалось определить местоположение");
        setLocating(false);
      },
    );
  }

  return (
    <div className="mb-6">
      <ServiceMap
        markers={[marker]}
        center={[lat, lng]}
        zoom={13}
        className="card h-[220px] w-full overflow-hidden"
      />
      <div className="mt-2 flex items-center gap-2 text-sm">
        {distanceKm != null ? (
          <span className="text-zinc-600 dark:text-zinc-400">
            ≈ {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} км от вас
          </span>
        ) : (
          <button type="button" onClick={handleShowDistance} disabled={locating} className="btn-secondary py-1.5 text-xs disabled:opacity-50">
            {locating ? "Определяем…" : "Показать расстояние до вас"}
          </button>
        )}
        {geoError && <span className="text-red-600">{geoError}</span>}
      </div>
    </div>
  );
}
