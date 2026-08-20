import { getHomeCarousels, getServiceMapMarkers, searchServices } from "@/lib/api";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const [servicesResult, markers, carousels] = await Promise.all([
    searchServices({ sortBy: "newest", limit: 12 }).catch(() => null),
    getServiceMapMarkers().catch(() => []),
    getHomeCarousels().catch(() => []),
  ]);

  return (
    <HomeClient
      services={servicesResult?.items ?? []}
      markers={markers}
      carousels={carousels}
    />
  );
}
