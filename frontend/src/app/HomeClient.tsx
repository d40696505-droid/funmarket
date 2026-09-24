"use client";

import Link from "next/link";
import { CategoryCarousel } from "@/components/CategoryCarousel";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceMap } from "@/components/ServiceMap";
import type { CategoryCarousel as CategoryCarouselData, Service, ServiceMapMarker } from "@/lib/api";

// Тематические фото активностей для коллажа в шапке главной (по одному на
// направление); авторы и лицензии — на странице /credits.
const HERO_PHOTOS = ["03", "06", "13", "21", "26", "37", "09", "31", "19", "10", "36", "07"];

export function HomeClient({
  services,
  markers,
  carousels,
}: {
  services: Service[];
  markers: ServiceMapMarker[];
  carousels: CategoryCarouselData[];
}) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="hero-nature">
        <div className="hero-collage" aria-hidden="true">
          {HERO_PHOTOS.map((name) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={name} src={`/hero/${name}.jpg`} alt="" loading="eager" />
          ))}
        </div>
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <div className="hero-glass">
            <h1 className="text-2xl font-bold sm:text-3xl">Навыки и активности рядом с вами</h1>
            <p className="mt-2 text-sm text-white/85 sm:text-base">
              Рыбалка, охота, путешествия, кулинария, ремесло — найдите мастера или
              организатора рядом с собой, на карте или в каталоге.
            </p>
            <Link href="/catalog" className="btn-primary mt-5 inline-flex">
              Весь каталог →
            </Link>
          </div>
        </div>
      </div>

      {carousels.length > 0 && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-8">
          {carousels.map((c) => (
            <CategoryCarousel key={c.category.id} category={c.category} services={c.services} />
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новые объявления</h2>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-zinc-500">Пока нет активных услуг</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10">
        <Link
          href="/map"
          className="card-glass group flex flex-col items-center gap-4 overflow-hidden p-0 sm:flex-row"
        >
          <div className="pointer-events-none h-40 w-full shrink-0 sm:h-32 sm:w-56">
            <ServiceMap markers={markers} className="h-full w-full" />
          </div>
          <div className="flex flex-1 flex-col gap-1 px-5 py-4 sm:py-0">
            <span className="font-medium text-zinc-900">Смотреть все услуги на карте</span>
            <span className="text-sm text-zinc-600">
              {markers.length > 0
                ? `${markers.length} предложений рядом с вами`
                : "Найдите мастера поблизости"}
            </span>
          </div>
          <span className="mr-5 hidden shrink-0 text-accent-dark group-hover:underline sm:inline">
            Открыть карту →
          </span>
        </Link>
      </div>

      <p className="pb-6 text-center text-xs text-zinc-400">
        <Link href="/credits" className="hover:underline">
          Источники фото
        </Link>
      </p>
    </main>
  );
}
