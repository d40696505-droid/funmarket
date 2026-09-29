import Image from "next/image";
import Link from "next/link";
import type { Service } from "@/lib/api";

function formatPrice(service: Service): string {
  if (service.priceType === "negotiable" || !service.priceMin) return "По договорённости";
  const unit =
    service.priceUnit === "hour" ? "/час" : service.priceUnit === "person" ? "/чел." : "";
  const prefix = service.priceType === "range" ? "от " : "";
  return `${prefix}${Number(service.priceMin).toLocaleString("ru-RU")} ₽${unit}`;
}

// Бегущая карусель реальных предложений в шапке главной — заменяет собой
// статичный фотоколлаж. Лента дублируется дважды и едет бесшовно через
// CSS-анимацию (см. .hero-marquee в globals.css); при наведении
// останавливается, чтобы карточку можно было спокойно рассмотреть и открыть.
export function HeroCarousel({ services }: { services: Service[] }) {
  if (services.length === 0) return null;
  // Не меньше ~14 карточек в ленте, чтобы бесшовный повтор не был заметен
  // даже на широких экранах — при нехватке реальных карточек зацикливаем их.
  const lane: Service[] = [];
  while (lane.length < 14) lane.push(...services);
  const track = [...lane, ...lane];

  return (
    <div className="hero-marquee" aria-hidden="true">
      <div className="hero-marquee-track">
        {track.map((service, i) => (
          <Link
            key={`${service.id}-${i}`}
            href={`/services/${service.id}`}
            tabIndex={-1}
            className="hero-marquee-card"
          >
            {service.images[0]?.url ? (
              <Image
                src={service.images[0].url}
                alt=""
                fill
                unoptimized
                sizes="200px"
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
            <div className="hero-marquee-card-info">
              <p className="truncate text-xs font-medium text-white">{service.title}</p>
              <p className="text-[11px] text-white/75">{formatPrice(service)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
