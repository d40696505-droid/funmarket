"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { BookingWidget } from "@/components/BookingWidget";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ServiceLocationWidget } from "@/components/ServiceLocationWidget";
import { createChat, type Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const PRICE_UNIT_LABEL: Record<Service["priceUnit"], string> = {
  hour: "час",
  event: "мероприятие",
  person: "человека",
};

const LOCATION_TYPE_LABEL: Record<Service["locationType"], string> = {
  address: "По адресу",
  mobile: "Выезд к клиенту",
  online: "Онлайн",
};

function formatPrice(service: Service): string {
  if (service.priceType === "negotiable") return "По договорённости";
  if (service.priceType === "fixed") {
    return `${Number(service.priceMin).toLocaleString("ru-RU")} ₽ / ${PRICE_UNIT_LABEL[service.priceUnit]}`;
  }
  return `${Number(service.priceMin).toLocaleString("ru-RU")}–${Number(service.priceMax).toLocaleString("ru-RU")} ₽ / ${PRICE_UNIT_LABEL[service.priceUnit]}`;
}

export function ServiceDetailClient({ service }: { service: Service }) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  async function handleMessageSeller() {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setMessaging(true);
    try {
      const chat = await createChat(service.sellerId);
      router.push(`/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть чат");
    } finally {
      setMessaging(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 lg:flex-row">
      <div className="lg:flex-1">
        {service.images.length === 0 && (
          <div
            className="relative mb-6 flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl"
            style={{
              background: "linear-gradient(160deg, rgba(245,197,24,0.15), rgba(245,197,24,0.28))",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-14 w-14 text-accent-dark/60"
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
        {service.images.length > 0 && (
          <div className="mb-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/5 dark:bg-white/10 sm:w-2/3"
            >
              <Image
                src={service.images[0].url}
                alt={service.title}
                fill
                unoptimized
                className="object-cover"
              />
            </button>
            {service.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto sm:w-1/3 sm:flex-col sm:overflow-y-auto">
                {service.images.slice(1).map((image, i) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setLightboxIndex(i + 1)}
                    className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10 sm:w-full"
                  >
                    <Image
                      src={image.url}
                      alt={service.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {lightboxIndex != null && (
          <ImageLightbox
            images={service.images.map((img) => img.url)}
            initialIndex={lightboxIndex}
            alt={service.title}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        <span className="text-sm text-zinc-500">{service.category?.name}</span>
        <h1 className="mt-1 mb-4 text-2xl font-semibold">{service.title}</h1>

        <p className="mb-6 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {service.description}
        </p>

        <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Длительность</dt>
            <dd>{service.durationMinutes} мин</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Локация</dt>
            <dd>{LOCATION_TYPE_LABEL[service.locationType]}</dd>
          </div>
          {service.city && (
            <div>
              <dt className="text-zinc-500">Город</dt>
              <dd>{service.city}</dd>
            </div>
          )}
          {service.locationAddress && (
            <div className="col-span-2">
              <dt className="text-zinc-500">Адрес</dt>
              <dd>{service.locationAddress}</dd>
            </div>
          )}
        </dl>

        <ServiceLocationWidget service={service} />

        {service.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {service.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-black/5 px-2.5 py-1 text-xs dark:bg-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {service.seller && (
          <div className="card mb-6 flex items-center gap-3 p-4">
            <Link
              href={`/sellers/${service.sellerId}`}
              className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                {service.seller.avatarUrl && (
                  <Image
                    src={service.seller.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {service.seller.brandName ||
                    [service.seller.firstName, service.seller.lastName].filter(Boolean).join(" ") ||
                    "Продавец"}
                </p>
                {service.seller.sellerType && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                    {service.seller.sellerType === "private" ? "Частный мастер" : "Профессионал"}
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1 text-sm text-zinc-500">
                {service.seller.reviewsCount > 0 && (
                  <>
                    <span className="text-accent">★</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {Number(service.seller.rating).toFixed(1)}
                    </span>
                    <span>({service.seller.reviewsCount})</span>
                    <span>·</span>
                  </>
                )}
                {service.seller.city}
              </p>
              {service.seller.skills && service.seller.skills.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {service.seller.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
              </div>
            </Link>
            {user?.id !== service.sellerId && (
              <button
                onClick={handleMessageSeller}
                disabled={messaging}
                className="btn-secondary ml-auto disabled:opacity-50"
              >
                {messaging ? "…" : "Написать"}
              </button>
            )}
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <ReviewsSection targetId={service.sellerId} />
      </div>

      <div className="lg:w-[380px] lg:shrink-0">
        <div className="lg:sticky lg:top-28">
          <p className="mb-4 text-xl font-semibold">{formatPrice(service)}</p>
          <BookingWidget service={service} onAuthRequired={() => setShowAuthPrompt(true)} />
        </div>
      </div>

      {showAuthPrompt && <AuthRequiredModal onClose={() => setShowAuthPrompt(false)} />}
    </main>
  );
}
