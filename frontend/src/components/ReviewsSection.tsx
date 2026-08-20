"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { getReviewsByTarget, replyToReview, type Review } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function reviewerName(r: Review["reviewer"]): string {
  return r.brandName || [r.firstName, r.lastName].filter(Boolean).join(" ") || "Пользователь";
}

export function ReviewsSection({ targetId }: { targetId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  useEffect(() => {
    Promise.resolve()
      .then(() => getReviewsByTarget(targetId))
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [targetId]);

  async function handleReply(reviewId: string) {
    const reply = replyDrafts[reviewId];
    if (!reply?.trim()) return;
    setError(null);
    try {
      const updated = await replyToReview(reviewId, reply);
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить ответ");
    }
  }

  if (loading) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-medium">Отзывы ({reviews.length})</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет отзывов</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <li key={review.id} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{reviewerName(review.reviewer)}</span>
                <span className="text-sm">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{review.text}</p>

              {review.photoUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {review.photoUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setLightbox({ photos: review.photoUrls, index: i })}
                      className="relative h-16 w-16 overflow-hidden rounded-lg bg-black/5 dark:bg-white/10"
                    >
                      <Image src={url} alt="Фото клиента" fill unoptimized className="object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {review.sellerReply && (
                <div className="mt-2 rounded-lg bg-black/5 p-2 text-sm dark:bg-white/10">
                  <span className="font-medium">Ответ продавца: </span>
                  {review.sellerReply}
                </div>
              )}

              {!review.sellerReply && user?.id === review.targetId && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={replyDrafts[review.id] ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))
                    }
                    placeholder="Ответить на отзыв..."
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={() => handleReply(review.id)}
                    className="rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
                  >
                    Отправить
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <ImageLightbox
          images={lightbox.photos}
          initialIndex={lightbox.index}
          alt="Фото клиента"
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}
