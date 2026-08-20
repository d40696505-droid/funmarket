"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CITIES } from "@/lib/cities";

const NAV_LINK_CLASS = "text-sm text-zinc-600 hover:text-accent dark:text-zinc-400";
const MOBILE_LINK_CLASS =
  "rounded-lg px-2 py-2 text-sm text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]";

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  function closeMenu() {
    setMenuOpen(false);
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
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight" onClick={closeMenu}>
          FunMarket
        </Link>

        <nav className="hidden shrink-0 items-center gap-6 text-sm md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
              {link.label}
            </Link>
          ))}
          {loading ? null : user ? (
            <>
              <Link href="/profile" className="font-medium hover:text-accent">
                {user.firstName ?? user.email}
              </Link>
              <button onClick={handleLogout} className="btn-secondary px-3 py-1.5">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={NAV_LINK_CLASS}>
                Вход
              </Link>
              <Link href="/register" className="btn-primary px-3.5 py-1.5">
                Регистрация
              </Link>
            </>
          )}
        </nav>

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

      <form
        onSubmit={handleSearchSubmit}
        className="mx-auto flex max-w-6xl items-center gap-2 border-t border-black/10 px-4 py-2.5 dark:border-white/10"
      >
        {searchFields}
      </form>

      {menuOpen && (
        <nav className="flex flex-col gap-0.5 border-t border-black/10 px-4 py-3 dark:border-white/10 md:hidden">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={MOBILE_LINK_CLASS} onClick={closeMenu}>
              {link.label}
            </Link>
          ))}
          {loading ? null : user ? (
            <>
              <Link
                href="/profile"
                className={`${MOBILE_LINK_CLASS} font-medium text-foreground dark:text-foreground`}
                onClick={closeMenu}
              >
                {user.firstName ?? user.email}
              </Link>
              <button onClick={handleLogout} className="btn-secondary mt-2 self-start px-3.5 py-1.5">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                Вход
              </Link>
              <Link
                href="/register"
                className="btn-primary mt-2 self-start px-3.5 py-1.5"
                onClick={closeMenu}
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
