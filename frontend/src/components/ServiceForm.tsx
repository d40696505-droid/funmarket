"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  getCategories,
  type Category,
  type CreateServiceInput,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CITIES } from "@/lib/cities";

export type ServiceFormValues = CreateServiceInput;

export function ServiceForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
}: {
  initial?: Service;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: ServiceFormValues) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [priceType, setPriceType] = useState<CreateServiceInput["priceType"]>(
    initial?.priceType ?? "fixed",
  );
  const [priceMin, setPriceMin] = useState(initial?.priceMin ?? "");
  const [priceMax, setPriceMax] = useState(initial?.priceMax ?? "");
  const [priceUnit, setPriceUnit] = useState<CreateServiceInput["priceUnit"]>(
    initial?.priceUnit ?? "hour",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initial?.durationMinutes ? String(initial.durationMinutes) : "60",
  );
  const [locationType, setLocationType] = useState<CreateServiceInput["locationType"]>(
    initial?.locationType ?? "address",
  );
  const [locationAddress, setLocationAddress] = useState(initial?.locationAddress ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [travelRadiusKm, setTravelRadiusKm] = useState(initial?.travelRadiusKm ?? "");
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity ? String(initial.capacity) : "1",
  );
  const { user } = useAuth();
  // Дефолт для новой услуги — от типа продавца: частный мастер обычно не
  // ведёт расписание и договаривается по запросу, профессионал — слоты.
  const [bookingMode, setBookingMode] = useState<CreateServiceInput["bookingMode"]>(
    initial?.bookingMode ?? (user?.sellerType === "private" ? "request" : "slots"),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (priceType !== "negotiable" && !priceMin) {
      setError("Укажите цену");
      return;
    }
    if (priceType === "range" && !priceMax) {
      setError("Укажите верхнюю границу цены");
      return;
    }
    if (locationType !== "online" && !locationAddress) {
      setError("Укажите адрес");
      return;
    }
    if (locationType === "mobile" && !travelRadiusKm) {
      setError("Укажите радиус выезда");
      return;
    }
    if (!city) {
      setError("Выберите город");
      return;
    }

    onSubmit({
      title,
      description,
      categoryId,
      priceType,
      priceMin: priceType !== "negotiable" ? Number(priceMin) : undefined,
      priceMax: priceType === "range" ? Number(priceMax) : undefined,
      priceUnit,
      durationMinutes: Number(durationMinutes),
      locationType,
      locationAddress: locationType !== "online" ? locationAddress : undefined,
      city,
      travelRadiusKm: locationType === "mobile" ? Number(travelRadiusKm) : undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
      bookingMode,
      capacity: Number(capacity) || 1,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Название (до 100 символов)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Описание (до 3000 символов)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={3000}
          rows={6}
          required
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Категория</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="input"
        >
          <option value="" disabled>
            Выберите категорию
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Город</span>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          className="input"
        >
          <option value="" disabled>
            Выберите город
          </option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Тип цены</span>
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as CreateServiceInput["priceType"])}
            className="input"
          >
            <option value="fixed">Фиксированная</option>
            <option value="range">От-до</option>
            <option value="negotiable">По договорённости</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Единица тарификации</span>
          <select
            value={priceUnit}
            onChange={(e) => setPriceUnit(e.target.value as CreateServiceInput["priceUnit"])}
            className="input"
          >
            <option value="hour">За час</option>
            <option value="event">За мероприятие</option>
            <option value="person">За человека</option>
          </select>
        </label>
      </div>

      {priceType !== "negotiable" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {priceType === "range" ? "Цена от" : "Цена"}
            </span>
            <input
              type="number"
              min={0}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="input"
            />
          </label>
          {priceType === "range" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Цена до</span>
              <input
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="input"
              />
            </label>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Длительность услуги (мин)</span>
        <input
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Локация оказания</span>
        <select
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as CreateServiceInput["locationType"])}
          className="input"
        >
          <option value="address">По адресу</option>
          <option value="mobile">Выезд к клиенту</option>
          <option value="online">Онлайн</option>
        </select>
      </label>

      {locationType !== "online" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Адрес</span>
          <input
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            className="input"
          />
        </label>
      )}

      {locationType === "mobile" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Радиус выезда (км)</span>
          <input
            type="number"
            min={0}
            value={travelRadiusKm}
            onChange={(e) => setTravelRadiusKm(e.target.value)}
            className="input"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Теги через запятую (до 10)</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Как принимать бронь</span>
        <select
          value={bookingMode}
          onChange={(e) =>
            setBookingMode(e.target.value as CreateServiceInput["bookingMode"])
          }
          className="input"
        >
          <option value="slots">По слотам расписания</option>
          <option value="request">По запросу — договоримся в чате</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          Вместимость группы (человек)
        </span>
        <input
          type="number"
          min={1}
          max={500}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="input"
        />
        <span className="text-xs text-zinc-500">
          1 — обычная бронь (один слот занимает один покупатель). Больше — несколько
          покупателей смогут забронировать один и тот же слот, пока не наберётся группа.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary mt-2"
      >
        {submitting ? "Сохраняем…" : submitLabel}
      </button>
    </form>
  );
}
