import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserProfile, searchServices } from "@/lib/api";
import { SellerProfileClient } from "./SellerProfileClient";

async function loadProfile(id: string) {
  try {
    return await getUserProfile(id);
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
  const profile = await loadProfile(id);
  if (!profile) {
    return { title: "Продавец не найден" };
  }
  const name =
    profile.brandName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Продавец";
  return { title: `${name} — FunMarket` };
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await loadProfile(id);
  if (!profile) {
    notFound();
  }

  const servicesResult = await searchServices({ sellerId: id, sortBy: "newest", limit: 50 }).catch(
    () => null,
  );

  return <SellerProfileClient profile={profile} services={servicesResult?.items ?? []} />;
}
