"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFollowedSellers, unfollowSeller, type ProfileSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function displayName(profile: ProfileSummary): string {
  return (
    profile.brandName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    "Продавец"
  );
}

export default function FollowingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [sellers, setSellers] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    getFollowedSellers()
      .then(setSellers)
      .catch(() => setSellers([]))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleUnfollow(id: string) {
    await unfollowSeller(id);
    setSellers((prev) => prev.filter((s) => s.id !== id));
  }

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Подписки</h1>

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : sellers.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Вы пока ни на кого не подписаны — нажмите «Подписаться» в профиле продавца, и мы
          сообщим, когда у него появятся новые услуги.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sellers.map((seller) => (
            <li key={seller.id} className="card flex items-center gap-3 p-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                {seller.avatarUrl && (
                  <Image
                    src={seller.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/sellers/${seller.id}`} className="font-medium hover:underline">
                  {displayName(seller)}
                </Link>
                <p className="truncate text-sm text-zinc-500">
                  {seller.city ?? ""}
                  {seller.skills.length > 0 ? ` · ${seller.skills.slice(0, 2).join(", ")}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleUnfollow(seller.id)}
                className="btn-secondary shrink-0 text-sm"
              >
                Отписаться
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
