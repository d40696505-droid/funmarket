"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveCityReview,
  approveService,
  getCityReviewQueue,
  getModerationQueue,
  getSellersForVerification,
  rejectCityReview,
  rejectServiceModeration,
  verifySeller,
  type PublicUser,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const PRICE_UNIT_LABEL: Record<Service["priceUnit"], string> = {
  hour: "/час",
  event: "/мероприятие",
  person: "/чел.",
};

function formatPrice(service: Service): string {
  if (service.priceType === "negotiable") return "По договорённости";
  const unit = PRICE_UNIT_LABEL[service.priceUnit] ?? "";
  if (service.priceType === "fixed") {
    return `${Number(service.priceMin).toLocaleString("ru-RU")} ₽${unit}`;
  }
  return `${Number(service.priceMin).toLocaleString("ru-RU")}–${Number(service.priceMax).toLocaleString("ru-RU")} ₽${unit}`;
}

const LOCATION_TYPE_LABEL: Record<Service["locationType"], string> = {
  address: "По адресу",
  mobile: "Выезд к клиенту",
  online: "Онлайн",
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"moderation" | "sellers" | "cities">("moderation");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [sellers, setSellers] = useState<PublicUser[]>([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [cityUsers, setCityUsers] = useState<PublicUser[]>([]);
  const [cityUsersLoading, setCityUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [moderationSearch, setModerationSearch] = useState("");
  const [moderationCategory, setModerationCategory] = useState("");
  const [sellersSearch, setSellersSearch] = useState("");
  const [sellersStatus, setSellersStatus] = useState<"all" | "verified" | "unverified">("all");
  const [citiesSearch, setCitiesSearch] = useState("");

  function sellerLabel(seller: PublicUser): string {
    return (
      seller.brandName ||
      [seller.firstName, seller.lastName].filter(Boolean).join(" ") ||
      seller.email
    );
  }

  const moderationCategories = Array.from(
    new Map(
      services
        .filter((s) => s.category)
        .map((s) => [s.category!.id, s.category!.name]),
    ).entries(),
  );

  const filteredServices = services.filter((service) => {
    if (moderationCategory && service.categoryId !== moderationCategory) return false;
    const q = moderationSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      service.title.toLowerCase().includes(q) ||
      service.description.toLowerCase().includes(q) ||
      (service.seller ? sellerLabel(service.seller).toLowerCase().includes(q) : false) ||
      (service.seller?.email ?? "").toLowerCase().includes(q)
    );
  });

  const filteredSellers = sellers.filter((seller) => {
    if (sellersStatus === "verified" && !seller.isSellerVerified) return false;
    if (sellersStatus === "unverified" && seller.isSellerVerified) return false;
    const q = sellersSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      sellerLabel(seller).toLowerCase().includes(q) ||
      seller.email.toLowerCase().includes(q)
    );
  });

  const filteredCityUsers = cityUsers.filter((cityUser) => {
    const q = citiesSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      sellerLabel(cityUser).toLowerCase().includes(q) ||
      cityUser.email.toLowerCase().includes(q) ||
      (cityUser.city ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  function reloadServices() {
    Promise.resolve()
      .then(() => setServicesLoading(true))
      .then(() => getModerationQueue())
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }

  function reloadSellers() {
    Promise.resolve()
      .then(() => setSellersLoading(true))
      .then(() => getSellersForVerification())
      .then(setSellers)
      .catch(() => setSellers([]))
      .finally(() => setSellersLoading(false));
  }

  function reloadCityUsers() {
    Promise.resolve()
      .then(() => setCityUsersLoading(true))
      .then(() => getCityReviewQueue())
      .then(setCityUsers)
      .catch(() => setCityUsers([]))
      .finally(() => setCityUsersLoading(false));
  }

  useEffect(() => {
    if (!user?.isAdmin) return;
    reloadServices();
    reloadSellers();
    reloadCityUsers();
  }, [user]);

  async function handleApprove(id: string) {
    setError(null);
    try {
      await approveService(id);
      reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить");
    }
  }

  async function handleReject(id: string) {
    const comment = prompt("Причина отклонения:");
    if (!comment) return;
    setError(null);
    try {
      await rejectServiceModeration(id, comment);
      reloadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить");
    }
  }

  async function handleToggleVerify(userId: string, verified: boolean) {
    setError(null);
    try {
      await verifySeller(userId, verified);
      reloadSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить верификацию");
    }
  }

  async function handleApproveCity(userId: string) {
    setError(null);
    try {
      await approveCityReview(userId);
      reloadCityUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось одобрить город");
    }
  }

  async function handleRejectCity(userId: string) {
    setError(null);
    try {
      await rejectCityReview(userId);
      reloadCityUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить город");
    }
  }

  if (authLoading || !user || !user.isAdmin) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Администрирование</h1>

      <div className="mb-6 flex gap-1 rounded-full border border-black/10 p-0.5 text-sm dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setTab("moderation")}
          className={`rounded-full px-3 py-1 ${tab === "moderation" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
        >
          Модерация услуг
        </button>
        <button
          type="button"
          onClick={() => setTab("sellers")}
          className={`rounded-full px-3 py-1 ${tab === "sellers" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
        >
          Верификация продавцов
        </button>
        <button
          type="button"
          onClick={() => setTab("cities")}
          className={`rounded-full px-3 py-1 ${tab === "cities" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
        >
          Города на проверке
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {tab === "moderation" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={moderationSearch}
              onChange={(e) => setModerationSearch(e.target.value)}
              placeholder="Поиск: название, описание, продавец…"
              className="input h-9 min-w-[220px] flex-1 py-1.5 text-sm"
            />
            {moderationCategories.length > 0 && (
              <select
                value={moderationCategory}
                onChange={(e) => setModerationCategory(e.target.value)}
                className="input h-9 w-auto shrink-0 py-1.5 text-sm"
              >
                <option value="">Все категории</option>
                {moderationCategories.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {servicesLoading ? (
            <p className="text-sm text-zinc-500">Загрузка…</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-zinc-500">Нет услуг на модерации</p>
          ) : filteredServices.length === 0 ? (
            <p className="text-sm text-zinc-500">Ничего не найдено по фильтру</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredServices.map((service) => {
                const expanded = expandedServiceId === service.id;
                return (
                <li key={service.id} className="card flex flex-col gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedServiceId(expanded ? null : service.id)}
                    className="flex items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-medium">
                        {service.title}
                        {service.images.length > 0 && (
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            📷 {service.images.length}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {service.seller ? sellerLabel(service.seller) : "Продавец"}
                        {service.category && ` · ${service.category.name}`}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {service.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-zinc-400">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="mt-1 flex flex-col gap-3 border-t border-black/10 pt-3 text-sm dark:border-white/10">
                      {service.images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {service.images.map((image) => (
                            <a
                              key={image.id}
                              href={image.url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative aspect-square overflow-hidden rounded-lg bg-black/5 dark:bg-white/10"
                            >
                              <Image
                                src={image.url}
                                alt=""
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
                        <dt className="text-zinc-400">Цена</dt>
                        <dd>{formatPrice(service)}</dd>
                        <dt className="text-zinc-400">Формат</dt>
                        <dd>
                          {LOCATION_TYPE_LABEL[service.locationType]}
                          {service.locationAddress && ` — ${service.locationAddress}`}
                        </dd>
                        <dt className="text-zinc-400">Город</dt>
                        <dd>{service.city ?? "—"}</dd>
                        <dt className="text-zinc-400">Длительность</dt>
                        <dd>{service.durationMinutes} мин</dd>
                        <dt className="text-zinc-400">Вместимость</dt>
                        <dd>{service.capacity}</dd>
                        <dt className="text-zinc-400">Email продавца</dt>
                        <dd>{service.seller?.email ?? "—"}</dd>
                      </dl>
                      {service.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {service.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => handleApprove(service.id)}
                      className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                    >
                      Одобрить
                    </button>
                    <button
                      onClick={() => handleReject(service.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      Отклонить
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "sellers" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={sellersSearch}
              onChange={(e) => setSellersSearch(e.target.value)}
              placeholder="Поиск: имя, бренд, email…"
              className="input h-9 min-w-[220px] flex-1 py-1.5 text-sm"
            />
            <select
              value={sellersStatus}
              onChange={(e) => setSellersStatus(e.target.value as typeof sellersStatus)}
              className="input h-9 w-auto shrink-0 py-1.5 text-sm"
            >
              <option value="all">Все</option>
              <option value="verified">Верифицированные</option>
              <option value="unverified">Не верифицированные</option>
            </select>
          </div>

          {sellersLoading ? (
            <p className="text-sm text-zinc-500">Загрузка…</p>
          ) : sellers.length === 0 ? (
            <p className="text-sm text-zinc-500">Нет продавцов</p>
          ) : filteredSellers.length === 0 ? (
            <p className="text-sm text-zinc-500">Ничего не найдено по фильтру</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredSellers.map((seller) => (
                <li
                  key={seller.id}
                  className="card flex items-center justify-between gap-2 p-4"
                >
                  <div>
                    <p className="font-medium">{sellerLabel(seller)}</p>
                    <p className="text-sm text-zinc-500">{seller.email}</p>
                    <p className="mt-1 text-sm">
                      {seller.isSellerVerified ? (
                        <span className="text-accent-dark">Верифицирован</span>
                      ) : (
                        <span className="text-zinc-500">Не верифицирован</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleVerify(seller.id, !seller.isSellerVerified)}
                    className={
                      seller.isSellerVerified
                        ? "rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                        : "btn-primary px-3.5 py-1.5 text-sm"
                    }
                  >
                    {seller.isSellerVerified ? "Снять верификацию" : "Верифицировать"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "cities" && (
        <>
          <div className="mb-4">
            <input
              value={citiesSearch}
              onChange={(e) => setCitiesSearch(e.target.value)}
              placeholder="Поиск: имя, email, город…"
              className="input h-9 w-full max-w-md py-1.5 text-sm"
            />
          </div>

          {cityUsersLoading ? (
            <p className="text-sm text-zinc-500">Загрузка…</p>
          ) : cityUsers.length === 0 ? (
            <p className="text-sm text-zinc-500">Нет городов на проверке</p>
          ) : filteredCityUsers.length === 0 ? (
            <p className="text-sm text-zinc-500">Ничего не найдено по фильтру</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredCityUsers.map((cityUser) => (
                <li key={cityUser.id} className="card flex items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{sellerLabel(cityUser)}</p>
                    <p className="text-sm text-zinc-500">{cityUser.email}</p>
                    <p className="mt-1 text-sm">
                      Указал город: <span className="font-medium">{cityUser.city}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => handleApproveCity(cityUser.id)}
                      className="rounded-full border border-black/10 px-3 py-1 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                    >
                      Одобрить
                    </button>
                    <button
                      onClick={() => handleRejectCity(cityUser.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      Отклонить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
