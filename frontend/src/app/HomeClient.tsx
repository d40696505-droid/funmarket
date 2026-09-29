"use client";

import Link from "next/link";
import { CategoryCarousel } from "@/components/CategoryCarousel";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceMap } from "@/components/ServiceMap";
import type { CategoryCarousel as CategoryCarouselData, Service, ServiceMapMarker } from "@/lib/api";

export function HomeClient({
  services,
  markers,
  carousels,
}: {
  services: Service[];
  markers: ServiceMapMarker[];
  carousels: CategoryCarouselData[];
}) {
  // По одной-две карточке с каждой категории — лента получается разнообразной,
  // а не «десять картинок вело подряд»; если каруселей нет (пустой каталог),
  // используем свежие услуги как запасной вариант.
  const heroServices =
    carousels.length > 0
      ? carousels.flatMap((c) => c.services.slice(0, 2))
      : services;

  return (
    <main className="flex flex-1 flex-col">
      <div className="hero-nature">
        <HeroCarousel services={heroServices} />
        {/* pointer-events-none: у обёртки w-full (нужен только для выравнивания
            левого края .hero-glass с остальными секциями страницы), поэтому
            без этого она перехватывала клики по карусели под собой по всей
            своей ширине, даже там, где сама плашка не нарисована. */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pointer-events-none">
          <div className="hero-glass pointer-events-auto">
            <h1 className="text-2xl font-bold sm:text-3xl">Навыки и активности рядом с вами</h1>
            <p className="mt-2 text-sm text-white/85 sm:text-base">
              Рыбалка, охота, путешествия, кулинария, ремесло — найдите мастера или
              организатора рядом с собой, на карте или в каталоге.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/catalog" className="btn-primary inline-flex">
                Весь каталог →
              </Link>
              <Link
                href="/map"
                className="group flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/30 bg-white/10 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-white/20"
              >
                {/* pointer-events-none: превью только показывает карту, тянуть/
                    зумить её незачем — вся плашка целиком ведёт на /map. */}
                <div className="pointer-events-none h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                  <ServiceMap markers={markers} zoom={9} className="h-full w-full" />
                </div>
                <span className="text-sm font-medium text-white">
                  Смотреть на карте
                  <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </div>
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
