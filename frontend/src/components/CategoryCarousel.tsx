import Link from "next/link";
import { ServiceCard } from "@/components/ServiceCard";
import type { CategoryCarousel as CategoryCarouselData } from "@/lib/api";

export function CategoryCarousel({ category, services }: CategoryCarouselData) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{category.name}</h2>
        <Link
          href={`/catalog?categoryId=${category.id}`}
          className="text-sm text-accent-dark hover:underline"
        >
          Все →
        </Link>
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {services.map((service) => (
          <div key={service.id} className="w-[240px] shrink-0 snap-start">
            <ServiceCard service={service} />
          </div>
        ))}
      </div>
    </section>
  );
}
