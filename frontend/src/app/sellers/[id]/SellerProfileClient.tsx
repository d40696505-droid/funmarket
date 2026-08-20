"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ServiceCard } from "@/components/ServiceCard";
import { createChat, type ProfileSummary, type Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function displayName(profile: ProfileSummary): string {
  return (
    profile.brandName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Пользователь"
  );
}

export function SellerProfileClient({
  profile,
  services,
}: {
  profile: ProfileSummary;
  services: Service[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [messaging, setMessaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  async function handleMessage() {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setMessaging(true);
    setError(null);
    try {
      const chat = await createChat(profile.id);
      router.push(`/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть чат");
    } finally {
      setMessaging(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="card mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          {profile.avatarUrl && (
            <Image
              src={profile.avatarUrl}
              alt=""
              width={80}
              height={80}
              unoptimized
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{displayName(profile)}</h1>
            {profile.sellerType && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
                {profile.sellerType === "private" ? "Частный мастер" : "Профессионал"}
              </span>
            )}
            {profile.isEmailVerified && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                Email подтверждён
              </span>
            )}
            {profile.isPhoneVerified && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                Телефон подтверждён
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            {Number(profile.rating) > 0 ? `★ ${Number(profile.rating).toFixed(1)}` : "Пока нет отзывов"}
            {profile.city ? ` · ${profile.city}` : ""}
          </p>

          {profile.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {user?.id !== profile.id && (
          <button
            onClick={handleMessage}
            disabled={messaging}
            className="btn-secondary shrink-0 disabled:opacity-50"
          >
            {messaging ? "…" : "Написать"}
          </button>
        )}
      </div>

      {profile.bio && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">О себе</h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {profile.bio}
          </p>
        </section>
      )}

      <h2 className="mb-3 text-lg font-semibold">Услуги</h2>
      {services.length === 0 ? (
        <p className="mb-8 text-sm text-zinc-500">Пока нет активных услуг</p>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}

      <ReviewsSection targetId={profile.id} />

      {showAuthPrompt && <AuthRequiredModal onClose={() => setShowAuthPrompt(false)} />}
    </main>
  );
}
