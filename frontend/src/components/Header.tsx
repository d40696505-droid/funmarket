"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { getCategories, type Category } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CITIES } from "@/lib/cities";
import { OPEN_SUPPORT_CHAT_EVENT } from "@/lib/support-chat";

const MOBILE_LINK_CLASS =
  "rounded-lg px-2 py-2 text-sm text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]";
const NEAR_ME_VALUE = "__near__";
const NEAR_ME_RADIUS_KM = 10;

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleContactSupport() {
    closeMenu();
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT));
  }

  function handleLogout() {
    closeMenu();
    logout();
    router.push("/");
  }

  function goToCatalog(nextQ: string, nextCity: string) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextCity) params.set("city", nextCity);
    const qs = params.toString();
    router.push(qs ? `/catalog?${qs}` : "/catalog");
    closeMenu();
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    goToCatalog(q, city);
  }

  function handleCityChange(value: string) {
    if (value === NEAR_ME_VALUE) {
      setCity(NEAR_ME_VALUE);
      if (!navigator.geolocation) {
        setCity("");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          params.set("lat", String(pos.coords.latitude));
          params.set("lng", String(pos.coords.longitude));
          params.set("radiusKm", String(NEAR_ME_RADIUS_KM));
          router.push(`/catalog?${params.toString()}`);
          setCity("");
          closeMenu();
        },
        () => setCity(""),
      );
      return;
    }
    setCity(value);
    goToCatalog(q, value);
  }

  const links: { href: string; label: string }[] = [
    { href: "/catalog", label: "Каталог" },
    { href: "/map", label: "Карта" },
  ];
  if (user) {
    links.push({ href: "/chats", label: "Чаты" });
    links.push({ href: "/favorites", label: "Избранное" });
    links.push({ href: "/following", label: "Подписки" });
    if (user.role === "buyer" || user.role === "both") {
      links.push({ href: "/orders", label: "Мои заказы" });
    }
    if (user.role === "seller" || user.role === "both") {
      links.push({ href: "/orders/incoming", label: "Входящие заказы" });
      links.push({ href: "/my-services", label: "Мои услуги" });
    }
    if (user.isAdmin) {
      links.push({ href: "/admin", label: "Админ" });
    }
  }

  // Активная вкладка — точное совпадение, либо вложенный путь (например,
  // /chats/[id] подсвечивает «Чаты»), но только если ни один другой пункт
  // меню не совпадает точнее (иначе /orders/incoming подсветил бы заодно
  // и «Мои заказы»).
  function isActive(href: string): boolean {
    if (pathname === href) return true;
    if (!pathname?.startsWith(`${href}/`)) return false;
    return !links.some(
      (l) => l.href !== href && l.href.startsWith(href) && pathname.startsWith(l.href),
    );
  }

  const searchFields = (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти услугу или мастера…"
        className="input h-9 min-w-[120px] flex-1 py-1.5 text-sm"
      />
      <select
        value={city}
        onChange={(e) => handleCityChange(e.target.value)}
        className="input h-9 w-auto shrink-0 py-1.5 text-sm"
      >
        <option value="">Все города</option>
        <option value={NEAR_ME_VALUE}>Рядом со мной</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight" onClick={closeMenu}>
          HobbyHub
        </Link>

        <nav className="hidden shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 p-1 text-sm md:flex dark:bg-white/10">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                isActive(link.href)
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="relative hidden shrink-0 md:block">
          <button
            type="button"
            onClick={() => setInterestsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.08]"
            aria-expanded={interestsOpen}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Интересы
          </button>
          {interestsOpen && (
            <>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setInterestsOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="card absolute right-0 top-full z-20 mt-2 w-56 p-2">
                {categories.length === 0 ? (
                  <p className="p-2 text-sm text-zinc-500">Загрузка…</p>
                ) : (
                  categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/catalog?categoryId=${c.id}`}
                      onClick={() => setInterestsOpen(false)}
                      className="block rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.08]"
                    >
                      {c.name}
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleContactSupport}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-sm text-zinc-600 hover:bg-black/[.04] md:flex dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.08]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            />
          </svg>
          Написать нам
        </button>

        <div className="ml-auto hidden shrink-0 items-center gap-3 text-sm md:flex">
          {loading ? null : user ? (
            <>
              <Link href="/profile" className="font-medium hover:text-accent-dark">
                {user.firstName ?? user.email}
              </Link>
              <button onClick={handleLogout} className="btn-secondary px-3 py-1.5">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-zinc-600 hover:text-accent-dark dark:text-zinc-400">
                Вход
              </Link>
              <Link href="/register" className="btn-dark px-3.5 py-1.5">
                Регистрация
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/[.04] dark:hover:bg-white/[.08] md:hidden"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {pathname === "/" && (
        <form
          onSubmit={handleSearchSubmit}
          className="mx-auto flex max-w-6xl items-center gap-2 border-t border-black/10 px-4 py-2.5 dark:border-white/10"
        >
          {searchFields}
        </form>
      )}

      {menuOpen && (
        <nav className="flex flex-col gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10 md:hidden">
          <div className="grid grid-cols-2 gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive(link.href)
                    ? "truncate rounded-lg bg-zinc-900 px-2 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                    : `truncate ${MOBILE_LINK_CLASS}`
                }
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleContactSupport}
              className={`truncate text-left ${MOBILE_LINK_CLASS}`}
            >
              Написать нам
            </button>
          </div>

          {categories.length > 0 && (
            <div className="border-t border-black/10 pt-2 dark:border-white/10">
              <p className="pb-1 text-xs text-zinc-500">Интересы</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/catalog?categoryId=${c.id}`}
                    onClick={closeMenu}
                    className="rounded-full border border-black/10 px-2.5 py-1 text-xs text-zinc-600 hover:bg-black/[.04] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/[.08]"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-black/10 pt-2 dark:border-white/10">
            {loading ? null : user ? (
              <>
                <Link
                  href="/profile"
                  className="truncate text-sm font-medium hover:underline"
                  onClick={closeMenu}
                >
                  {user.firstName ?? user.email}
                </Link>
                <button onClick={handleLogout} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm hover:underline" onClick={closeMenu}>
                  Вход
                </Link>
                <Link
                  href="/register"
                  className="btn-dark shrink-0 px-3 py-1.5 text-sm"
                  onClick={closeMenu}
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </nav>
      )}

      {showAuthPrompt && (
        <AuthRequiredModal
          onClose={() => setShowAuthPrompt(false)}
          message="Чтобы написать в поддержку, нужно войти в аккаунт или зарегистрироваться."
        />
      )}
    </header>
  );
}
