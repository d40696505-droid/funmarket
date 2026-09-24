"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createBooking,
  getAvailableSlots,
  type AvailableSlot,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function BookingWidget({
  service,
  onAuthRequired,
}: {
  service: Service;
  onAuthRequired: () => void;
}) {
  const { user } = useAuth();
  const isRequestMode = service.bookingMode === "request";

  const today = new Date().toISOString().slice(0, 10);

  // Дефолт — сегодня: минимальный лид-тайм брони — 1 час, поэтому в течение
  // дня почти всегда остаются реальные слоты. Ленивый инициализатор — просто
  // для единообразия с датой, которую видно в самом первом рендере.
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [requestTime, setRequestTime] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [comment, setComment] = useState("");
  // true изначально: слоты на defaultDate всегда подгружаются сразу при
  // монтировании, поэтому до первого ответа не должно мелькать "нет слотов".
  const [loadingSlots, setLoadingSlots] = useState(!isRequestMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function loadSlots(value: string) {
    Promise.resolve()
      .then(() => setLoadingSlots(true))
      .then(() => getAvailableSlots(service.sellerId, service.id, value))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }

  // Слоты видны всем, включая незалогиненных — это витрина свободного времени,
  // а не форма бронирования; вход требуется только на этапе выбора слота.
  // У услуг "по запросу" нет расписания — грузить слоты не нужно.
  useEffect(() => {
    if (!isRequestMode) loadSlots(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDateChange(value: string) {
    setDate(value);
    setSelectedSlot(null);
    setError(null);
    if (isRequestMode) return;
    if (!value) {
      setSlots([]);
      return;
    }
    loadSlots(value);
  }

  function handleSelectSlot(slot: AvailableSlot) {
    if (!user) {
      onAuthRequired();
      return;
    }
    setSelectedSlot(slot);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      onAuthRequired();
      return;
    }
    const startTime = isRequestMode ? requestTime : selectedSlot?.startTime;
    if (!startTime) return;
    setError(null);
    setSubmitting(true);
    try {
      await createBooking({
        serviceId: service.id,
        date,
        startTime,
        locationAddress: locationAddress || undefined,
        comment: comment || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать бронирование");
    } finally {
      setSubmitting(false);
    }
  }

  if (process.env.NEXT_PUBLIC_ORDERS_DISABLED === "true") {
    return (
      <div className="card flex flex-col gap-1 p-4">
        <p className="font-medium">Сайт в разработке</p>
        <p className="text-sm text-zinc-500">
          Оформление бронирования временно недоступно — мы ещё дорабатываем сервис.
          Загляните позже.
        </p>
      </div>
    );
  }

  if (user && user.id === service.sellerId) {
    return null;
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
        Заявка отправлена продавцу. Следите за статусом в «Мои заказы».
      </div>
    );
  }

  const canSubmit = isRequestMode
    ? TIME_PATTERN.test(requestTime) && comment.trim().length > 0
    : !!selectedSlot;

  return (
    <form
      onSubmit={handleSubmit}
      className="card flex flex-col gap-3 p-4"
    >
      <h2 className="font-medium">
        {isRequestMode ? "Запрос на бронирование" : "Свободные слоты"}
      </h2>
      {!user && (
        <p className="text-sm text-zinc-500">
          {isRequestMode
            ? "Опишите, что хотите заказать — для отправки запроса потребуется войти в аккаунт."
            : "Выберите время — для бронирования потребуется войти в аккаунт."}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          {isRequestMode ? "Желаемая дата" : "Дата"}
        </span>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          required
          className="input"
        />
      </label>

      {isRequestMode ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Желаемое время</span>
          <input
            type="time"
            value={requestTime}
            onChange={(e) => setRequestTime(e.target.value)}
            required
            className="input"
          />
        </label>
      ) : (
        date && (
          <div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Время</span>
            {loadingSlots ? (
              <p className="mt-1 text-sm text-zinc-500">Загрузка слотов…</p>
            ) : slots.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">Нет свободных слотов на эту дату</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selectedSlot?.startTime === slot.startTime
                        ? "border-accent bg-accent text-white"
                        : "border-black/10 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                    }`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {(isRequestMode || selectedSlot) && service.locationType === "mobile" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Адрес проведения</span>
          <input
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
            required
            className="input"
          />
        </label>
      )}

      {(isRequestMode || selectedSlot) && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            {isRequestMode
              ? "Опишите, что хотите заказать и удобное время"
              : "Комментарий (необязательно)"}
          </span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required={isRequestMode}
            className="input"
          />
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="btn-primary"
      >
        {submitting ? "Отправляем…" : isRequestMode ? "Отправить запрос" : "Забронировать"}
      </button>
      {process.env.NEXT_PUBLIC_PAYMENTS_DISABLED === "true" && (
        <p className="text-xs text-zinc-500">
          Онлайн-оплаты пока нет: бронь считается состоявшейся после подтверждения продавцом,
          расчёт — напрямую с ним.
        </p>
      )}
    </form>
  );
}
