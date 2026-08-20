"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFavorites } from "@/lib/favorites-context";

function formatPrice(service: Service): string {
  if (service.priceType === "negotiable") return "По договорённости";
  const unit =
    service.priceUnit === "hour" ? "/час" : service.priceUnit === "person" ? "/чел." : "";
  if (service.priceType === "fixed") {
    return `${Number(service.priceMin).toLocaleString("ru-RU")} ₽${unit}`;
  }
  return `от ${Number(service.priceMin).toLocaleString("ru-RU")} ₽${unit}`;
}

// Карточка услуги всегда в стеклянном стиле (.card-glass) — светлый
// полупрозрачный фон, не завязанный на тему light/dark, поэтому весь
// текст внутри карточки задаётся явно тёмным (не через --foreground,
// который в тёмной теме уходит в белый и станет невидимым на светлом стекле).
export function ServiceCard({ service }: { service: Service }) {
  const cover = service.images[0]?.url;
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const router = useRouter();
  const isFavorited = ids.has(service.id);
  const showFavorite = !!user && user.id !== service.sellerId;

  function handleToggleFavorite(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(service.id);
  }

  // Не <Link> — вложенный <a> внутри карточки-<Link> недопустим в HTML.
  function handleSellerClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/sellers/${service.sellerId}`);
  }

  return (
    <Link
      href={`/services/${service.id}`}
      className="card-glass flex flex-col overflow-hidden hover:border-accent/50"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {cover ? (
          <Image src={cover} alt={service.title} fill unoptimized className="object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                "linear-gradient(160deg, rgba(139,195,74,0.18), rgba(139,195,74,0.32))",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-accent/50"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="1.75" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.12 0L4 19" />
            </svg>
          </div>
        )}
        {showFavorite && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={isFavorited ? "Убрать из избранного" : "Добавить в избранное"}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform hover:scale-110"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4.5 w-4.5"
              fill={isFavorited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s-6.716-4.35-9.428-8.28C.8 10.02 1.2 6.5 4.2 5.02 6.6 3.84 9.2 4.6 12 7.5c2.8-2.9 5.4-3.66 7.8-2.48 3 1.48 3.4 5 1.628 7.7C18.716 16.65 12 21 12 21z"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3.5 text-zinc-900">
        <span className="text-xs text-zinc-600">{service.category?.name}</span>
        <h3 className="line-clamp-2 min-h-11 font-medium leading-snug text-zinc-900">
          {service.title}
        </h3>
        {service.seller && (
          <button
            type="button"
            onClick={handleSellerClick}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-accent"
          >
            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
              {service.seller.avatarUrl && (
                <Image
                  src={service.seller.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <span className="truncate">
              {service.seller.brandName ||
                [service.seller.firstName, service.seller.lastName].filter(Boolean).join(" ") ||
                "Продавец"}
              {service.seller.city ? ` · ${service.seller.city}` : ""}
            </span>
          </button>
        )}
        <div className="mt-1 flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-zinc-900">{formatPrice(service)}</span>
          {service.seller && Number(service.seller.rating) > 0 && (
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 shadow-sm">
              ★ {Number(service.seller.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
