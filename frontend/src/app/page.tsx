import { getHomeCarousels, getServiceMapMarkers, searchServices } from "@/lib/api";
import { HomeClient } from "./HomeClient";

// Без этого главная prerender-ится один раз при сборке и навсегда остаётся с
// тем набором карточек, что был на момент деплоя.
export const revalidate = 60;

export default async function Home() {
  const [servicesResult, markers, carousels] = await Promise.all([
    // limit 40 — под общий перемешанный список на главной (раньше сюда же
    // добавлялись отдельные карусели по категориям, теперь их нет, а
    // перемешивается и показывается один общий список).
    searchServices({ sortBy: "newest", limit: 40 }).catch(() => null),
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
