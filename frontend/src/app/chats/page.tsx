"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyChats, type ChatSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function participantName(p: ChatSummary["otherParticipant"]): string {
  return p.brandName || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Пользователь";
}

export default function ChatsListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.resolve()
      .then(() => getMyChats())
      .then(setChats)
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Чаты</h1>

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : chats.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет диалогов</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/chats/${chat.id}`}
                className="flex items-center gap-3 py-3 hover:bg-black/[.02] dark:hover:bg-white/[.04]"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  {chat.otherParticipant.avatarUrl && (
                    <Image
                      src={chat.otherParticipant.avatarUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                  {chat.isOnline && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{participantName(chat.otherParticipant)}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {chat.lastMessageText ?? "Нет сообщений"}
                  </p>
                </div>
                {chat.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs text-white">
                    {chat.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
