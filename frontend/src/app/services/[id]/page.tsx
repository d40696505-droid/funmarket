import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceById } from "@/lib/api";
import { ServiceDetailClient } from "./ServiceDetailClient";

async function loadService(id: string) {
  try {
    return await getServiceById(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const service = await loadService(id);
  if (!service) {
    return { title: "Услуга не найдена" };
  }
  const description = service.description.slice(0, 160);
  return {
    title: service.title,
    description,
    openGraph: {
      title: service.title,
      description,
      images: service.images[0] ? [service.images[0].url] : undefined,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await loadService(id);
  if (!service) {
    notFound();
  }
  return <ServiceDetailClient service={service} />;
}
