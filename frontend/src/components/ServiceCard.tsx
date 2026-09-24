"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { createChat, type NextSlot, type Service } from "@/lib/api";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
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

const MSK = "Europe/Moscow";

// «сегодня в 18:00», «завтра в 10:00», «сб, 26 сен в 10:00» — день считаем по
// Москве, как и слоты на бэкенде.
function formatNextSlot(slot: NextSlot): string {
  const time = slot.startTime.slice(0, 5);
  if (slot.isToday) return `сегодня в ${time}`;
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: MSK });
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (slot.date === dayKey(tomorrow)) return `завтра в ${time}`;
  const label = new Date(`${slot.date}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${label} в ${time}`;
}

export function ServiceCard({ service }: { service: Service }) {
  const cover = service.images[0]?.url;
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const router = useRouter();
  const [messaging, setMessaging] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const isFavorited = ids.has(service.id);
  const isOwnService = !!user && user.id === service.sellerId;
  const showFavorite = !!user && !isOwnService;

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

  // «Написать» и «Позвонить» ведут в чат с продавцом — номер телефона
  // нигде публично не раскрывается (см. toProfileSummary), поэтому это
  // единственный способ связаться, который у нас есть для обеих иконок.
  async function handleContactClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isOwnService) return;
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setMessaging(true);
    try {
      const chat = await createChat(service.sellerId);
      router.push(`/chats/${chat.id}`);
    } catch {
      // Карточка в сетке — не место для развёрнутой ошибки; молча не
      // переходим, продавец останется доступен через страницу услуги.
    } finally {
      setMessaging(false);
    }
  }

  return (
    <>
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
                "linear-gradient(160deg, rgba(245,197,24,0.15), rgba(245,197,24,0.28))",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-accent-dark/60"
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
        {service.nextSlot?.isToday && (
          <span className="absolute left-2 top-2 rounded-full bg-green-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            Можно сегодня
          </span>
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
      <div className="flex flex-col gap-1.5 p-3.5">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{service.category?.name}</span>
        <h3 className="line-clamp-2 min-h-11 font-medium leading-snug">{service.title}</h3>
        {service.seller && (
          <button
            type="button"
            onClick={handleSellerClick}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-accent-dark dark:text-zinc-400"
          >
            <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
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
        {service.nextSlot && (
          <p
            className={`text-xs ${
              service.nextSlot.isToday
                ? "font-medium text-green-700 dark:text-green-400"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            Ближайшая запись: {formatNextSlot(service.nextSlot)}
          </p>
        )}
        <div className="mt-1 flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold">{formatPrice(service)}</span>
          {service.seller && Number(service.seller.reviewsCount) > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="text-accent">★</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {Number(service.seller.rating).toFixed(1)}
              </span>
              <span>({service.seller.reviewsCount})</span>
            </span>
          )}
        </div>

        {!isOwnService && (
          <div className="mt-1 flex items-center gap-2 border-t border-black/10 pt-2.5 dark:border-white/10">
            <button
              type="button"
              onClick={handleContactClick}
              disabled={messaging}
              aria-label="Написать продавцу"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.08]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleContactClick}
              disabled={messaging}
              aria-label="Позвонить продавцу"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.08]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5.5c0-1.1.9-2 2-2h2.2c.5 0 1 .4 1.1.9l.9 3.5c.1.4 0 .9-.3 1.2l-1.5 1.5a13 13 0 0 0 5.8 5.8l1.5-1.5c.3-.3.8-.4 1.2-.3l3.5.9c.5.1.9.6.9 1.1V19c0 1.1-.9 2-2 2h-1C9.4 21 3 14.6 3 6.5v-1z"
                />
              </svg>
            </button>
            <span
              aria-hidden
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
            </span>
          </div>
        )}
      </div>

    </Link>
    {showAuthPrompt && <AuthRequiredModal onClose={() => setShowAuthPrompt(false)} />}
    </>
  );
}
