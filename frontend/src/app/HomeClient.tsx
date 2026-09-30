"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceMap } from "@/components/ServiceMap";
import type { CategoryCarousel as CategoryCarouselData, Service, ServiceMapMarker } from "@/lib/api";

// Fisher–Yates, не .sort(() => Math.random() - 0.5) — тот даёт неравномерное
// распределение (смещён к исходному порядку).
function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

  // Раньше ниже баннера были отдельные карусели по категориям — теперь один
  // общий список вперемешку. useMemo с зависимостью от services (новый
  // объект при каждом заходе на страницу — см. page.tsx) — порядок
  // перемешивается заново при каждой загрузке страницы, но не дёргается на
  // каждый повторный рендер компонента (лайк/избранное и т.п.).
  const shuffledServices = useMemo(() => shuffled(services), [services]);

  return (
    <main className="flex flex-1 flex-col">
      <div className="hero-nature">
        <HeroCarousel services={heroServices} />
        {/* pointer-events-none: у обёртки w-full (нужен только для выравнивания
            левого края .hero-glass с остальными секциями страницы), поэтому
            без этого она перехватывала клики по карусели под собой по всей
            своей ширине, даже там, где сама плашка не нарисована. */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pointer-events-none">
          {/* Размеры текста/отступов подобраны вручную под увеличенную на 15%
              высоту и 10% ширину плашки (см. .hero-glass, .hero-map-card в
              globals.css) — не связаны напрямую с шагами Tailwind. */}
          <div className="hero-glass pointer-events-auto flex items-center gap-[1.15rem]">
            <div>
              <h1 className="text-[1.29rem] font-bold sm:text-[1.4375rem]">
                Навыки и активности рядом с вами
              </h1>
              <p className="mt-1 text-[0.8625rem] text-white/85 sm:text-[1.00625rem]">
                Рыбалка, охота, путешествия, кулинария, ремесло — найдите мастера или
                организатора рядом с собой, на карте или в каталоге.
              </p>
              <Link
                href="/catalog"
                className="btn-primary mt-[0.8625rem] inline-flex px-[1.15rem] py-[0.575rem] text-[1.00625rem]"
              >
                Весь каталог →
              </Link>
            </div>

            {/* Виджет карты внутри плашки, справа от текста — сама не едет,
                просто показывает точки услуг и целиком ведёт на /map. */}
            <Link href="/map" className="hero-map-card group hidden shrink-0 sm:block">
              <ServiceMap markers={markers} zoom={9} controls={[]} className="pointer-events-none h-full w-full" />
              <div className="hero-marquee-card-info">
                <p className="text-xs font-medium text-white">
                  Смотреть на карте
                  <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </p>
                <p className="text-[10px] text-white/75">
                  {markers.length > 0 ? `${markers.length} предложений рядом` : "Все услуги рядом"}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* max-w-7xl — как у шапки и остальных секций сайта (см. Header.tsx);
          xl:grid-cols-5 — лишняя колонка карточек на широких экранах. */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Все услуги</h2>
        </div>
        {shuffledServices.length === 0 ? (
          <p className="text-sm text-zinc-500">Пока нет активных услуг</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shuffledServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-10">
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
