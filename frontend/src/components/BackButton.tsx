"use client";

import { useRouter } from "next/navigation";

// Кнопка "назад" для страниц с несколькими точками входа (карточка услуги
// открывается из каталога, избранного, подписок и т.д.) — обычная browser
// back возвращает туда, откуда реально пришли, а не на жёстко зашитую
// страницу. fallbackHref — на случай, если страница открыта напрямую по
// ссылке и истории браузера внутри сайта нет (тогда history.back() увёл бы
// на внешний сайт или на пустую вкладку).
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:underline"
    >
      ← Назад
    </button>
  );
}
