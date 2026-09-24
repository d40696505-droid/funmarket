import type { Metadata } from "next";
import credits from "@/lib/photo-credits.json";

export const metadata: Metadata = { title: "Источники фото — HobbyHub" };

type Credit = { file: string; author: string; license: string; page: string };

export default function CreditsPage() {
  const entries = Object.entries(credits as Record<string, Credit>).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Источники фото</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Иллюстрации в демонстрационных карточках и на главной странице взяты из Wikimedia
        Commons и распространяются по свободным лицензиям (CC0, общественное достояние,
        CC BY, CC BY-SA). Спасибо авторам.
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {entries.map(([n, c]) => (
          <li key={n} className="card p-3">
            <a href={c.page} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              {c.file}
            </a>
            <span className="text-zinc-500">
              {" "}
              — {c.author || "автор не указан"}, {c.license}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
