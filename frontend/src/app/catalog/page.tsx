import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogClient } from "./CatalogClient";

export const metadata: Metadata = {
  title: "Каталог услуг",
  description:
    "Каталог развлекательных услуг: аниматоры, ведущие, фотографы и другие исполнители рядом с вами.",
};

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogClient />
    </Suspense>
  );
}
