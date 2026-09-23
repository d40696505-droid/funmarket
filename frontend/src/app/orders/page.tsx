"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import {
  acceptReschedule,
  cancelBooking,
  createReview,
  disputeBooking,
  getMyBookings,
  initiatePayment,
  refundCancelBooking,
  rejectReschedule,
  uploadReviewPhotoFile,
  type Booking,
} from "@/lib/api";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/booking-status";
import { useAuth } from "@/lib/auth-context";

const MAX_REVIEW_PHOTOS = 3;

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewFormFor, setReviewFormFor] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "calendar">("list");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function reload() {
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => getMyBookings({ as: "buyer" }))
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user) reload();
  }, [user]);

  async function handleCancel(id: string) {
    if (!confirm("Отменить бронирование?")) return;
    setActionError(null);
    try {
      await cancelBooking(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отменить");
    }
  }

  async function handlePay(id: string) {
    setActionError(null);
    try {
      const { redirectUrl } = await initiatePayment(id);
      router.push(redirectUrl.replace(/^https?:\/\/[^/]+/, ""));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось начать оплату");
    }
  }

  async function handleRefundCancel(id: string) {
    if (!confirm("Отменить оплаченный заказ и вернуть средства?")) return;
    setActionError(null);
    try {
      await refundCancelBooking(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отменить с возвратом");
    }
  }

  async function handleDispute(id: string) {
    const reason = prompt("Опишите проблему — админ рассмотрит спор по переписке в чате:");
    if (!reason) return;
    setActionError(null);
    try {
      await disputeBooking(id, reason);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось открыть спор");
    }
  }

  async function handleAcceptReschedule(id: string) {
    setActionError(null);
    try {
      await acceptReschedule(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось подтвердить перенос");
    }
  }

  async function handleRejectReschedule(id: string) {
    if (
      !confirm(
        "Отклонить перенос? Заказ будет полностью отменён, деньги вернутся вам — это действие необратимо.",
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await rejectReschedule(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отклонить перенос");
    }
  }

  async function handleSubmitReview(bookingId: string) {
    setActionError(null);
    try {
      await createReview({
        bookingId,
        rating: reviewRating,
        text: reviewText,
        photoUrls: reviewPhotos.length > 0 ? reviewPhotos : undefined,
      });
      setReviewedIds((prev) => new Set(prev).add(bookingId));
      setReviewFormFor(null);
      setReviewText("");
      setReviewRating(5);
      setReviewPhotos([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось отправить отзыв");
    }
  }

  async function handleReviewPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || reviewPhotos.length >= MAX_REVIEW_PHOTOS) return;
    setActionError(null);
    setUploadingPhoto(true);
    try {
      const url = await uploadReviewPhotoFile(file);
      setReviewPhotos((prev) => [...prev, url]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRemoveReviewPhoto(url: string) {
    setReviewPhotos((prev) => prev.filter((u) => u !== url));
  }

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои заказы</h1>
        <div className="flex gap-1 rounded-full border border-black/10 p-0.5 text-sm dark:border-white/10">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-3 py-1 ${view === "list" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
          >
            Список
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`rounded-full px-3 py-1 ${view === "calendar" ? "bg-accent text-white" : "hover:bg-black/[.04] dark:hover:bg-white/[.08]"}`}
          >
            Календарь
          </button>
        </div>
      </div>

      {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет заказов</p>
      ) : view === "calendar" ? (
        <BookingsCalendar bookings={bookings} />
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="card flex flex-col gap-2 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/services/${booking.serviceId}`}
                      className="font-medium hover:underline"
                    >
                      {booking.service?.title ?? "Услуга"}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[booking.status]}`}>
                      {STATUS_LABEL[booking.status]}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {booking.bookingDate} {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}
                    {booking.totalAmount && ` · ${Number(booking.totalAmount).toLocaleString("ru-RU")} ₽`}
                  </p>
                  {booking.rejectionReason && (
                    <p className="mt-1 text-sm text-red-600">{booking.rejectionReason}</p>
                  )}
                </div>

                {booking.status === "pending" && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="self-start rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                  >
                    Отменить
                  </button>
                )}

                {booking.status === "awaiting_payment" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePay(booking.id)}
                      className="btn-primary self-start px-4 py-2 text-sm"
                    >
                      Оплатить
                    </button>
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="self-start rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      Отменить
                    </button>
                  </div>
                )}

                {booking.status === "paid" && booking.proposedDate && (
                  <div className="flex flex-col items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Продавец предлагает перенести заказ на{" "}
                      <span className="font-medium">
                        {booking.proposedDate} {booking.proposedStartTime?.slice(0, 5)}
                      </span>{" "}
                      (сейчас {booking.bookingDate} {booking.startTime.slice(0, 5)}). Если новое
                      время не подходит — заказ можно только отменить целиком, с возвратом денег.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptReschedule(booking.id)}
                        className="rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                      >
                        Подтвердить перенос
                      </button>
                      <button
                        onClick={() => handleRejectReschedule(booking.id)}
                        className="rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      >
                        Отклонить и отменить заказ
                      </button>
                    </div>
                  </div>
                )}

                {booking.status === "paid" && (
                  <div className="flex gap-2">
                    {new Date(booking.bookingDate) > new Date() && (
                      <button
                        onClick={() => handleRefundCancel(booking.id)}
                        className="self-start rounded-full border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                      >
                        Отменить с возвратом
                      </button>
                    )}
                    <button
                      onClick={() => handleDispute(booking.id)}
                      className="self-start rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                    >
                      Открыть спор
                    </button>
                  </div>
                )}

                {booking.status === "disputed" && (
                  <span className="self-start text-sm text-zinc-500">
                    Спор рассматривает администратор
                  </span>
                )}

                {booking.status === "completed" && !reviewedIds.has(booking.id) && (
                  <button
                    onClick={() =>
                      setReviewFormFor(reviewFormFor === booking.id ? null : booking.id)
                    }
                    className="self-start rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Оставить отзыв
                  </button>
                )}
                {booking.status === "completed" && reviewedIds.has(booking.id) && (
                  <span className="text-sm text-zinc-500">Отзыв оставлен</span>
                )}
              </div>

              {reviewFormFor === booking.id && (
                <div className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                  <div className="flex gap-1 text-lg">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        className={n <= reviewRating ? "text-yellow-500" : "text-zinc-300"}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={3}
                    placeholder="Расскажите, как всё прошло"
                    className="input"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {reviewPhotos.map((url) => (
                      <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg">
                        <Image src={url} alt="" fill unoptimized className="object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveReviewPhoto(url)}
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white"
                          aria-label="Убрать фото"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {reviewPhotos.length < MAX_REVIEW_PHOTOS && (
                      <label className="text-sm">
                        <span className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]">
                          {uploadingPhoto ? "Загрузка…" : "+ Фото"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleReviewPhotoChange}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <button
                    onClick={() => handleSubmitReview(booking.id)}
                    disabled={!reviewText.trim()}
                    className="btn-primary self-start px-4 py-2"
                  >
                    Отправить отзыв
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
