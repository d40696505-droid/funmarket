"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createChat,
  getChatMessages,
  getMyChats,
  getSupportContact,
  sendChatMessageRest,
  type ChatMessage,
  type ChatSummary,
  type SupportContact,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getChatSocket } from "@/lib/socket";

const POLL_INTERVAL_MS = 4000;
const WS_CONNECT_TIMEOUT_MS = 3000;

function participantName(p: ChatSummary["otherParticipant"]): string {
  return p.brandName || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Пользователь";
}

export function ChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [supportContact, setSupportContact] = useState<SupportContact | null>(null);
  const [openingSupport, setOpeningSupport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const unreadTotal = chats.reduce((sum, c) => sum + c.unreadCount, 0);
  // Чат с поддержкой закреплён отдельной строкой сверху — не дублируем его
  // и в обычном списке ниже.
  const supportChat = supportContact
    ? (chats.find((c) => c.otherParticipant.id === supportContact.id) ?? null)
    : null;
  const regularChats = supportContact
    ? chats.filter((c) => c.otherParticipant.id !== supportContact.id)
    : chats;

  function reloadChats() {
    getMyChats()
      .then(setChats)
      .catch(() => {});
  }

  function mergeMessage(msg: ChatMessage) {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }

  // Список чатов и счётчик непрочитанных — грузим сразу после логина,
  // независимо от того, открыт ли сам виджет (бейдж должен быть виден и
  // свёрнутым).
  useEffect(() => {
    if (!user) return;
    reloadChats();
  }, [user]);

  // Аккаунт поддержки настраивается вручную (см. User.isSupport) — если он
  // не задан, эндпоинт отдаёт 404 и пункт «Поддержка» просто не появится.
  useEffect(() => {
    if (!user) return;
    getSupportContact()
      .then(setSupportContact)
      .catch(() => setSupportContact(null));
  }, [user]);

  // WebSocket подключается один раз для пользователя (не только пока
  // открыт конкретный диалог) — событие chat:notify эмитится бэкендом в
  // персональную комнату при подключении сокета, этого достаточно, чтобы
  // обновлять бейдж непрочитанных на любой странице сайта.
  useEffect(() => {
    if (!user) return;
    const socket = getChatSocket();
    if (!socket) return;

    let connectTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setWsConnected(false);
    }, WS_CONNECT_TIMEOUT_MS);

    function handleConnect() {
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      setWsConnected(true);
    }
    function handleDisconnect() {
      setWsConnected(false);
    }
    function handleNotify() {
      reloadChats();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:notify", handleNotify);
    if (socket.connected) handleConnect();

    return () => {
      if (connectTimeout) clearTimeout(connectTimeout);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:notify", handleNotify);
    };
  }, [user]);

  // Открытый диалог внутри виджета — join комнаты чата, приём сообщений в
  // реальном времени, тот же паттерн, что на полной странице /chats/[id].
  useEffect(() => {
    if (!user || !activeChatId) return;
    const socket = getChatSocket();
    if (!socket) return;

    function handleNewMessage(msg: ChatMessage) {
      if (msg.chatId !== activeChatId) return;
      mergeMessage(msg);
    }

    socket.emit("chat:join", { chatId: activeChatId });
    socket.on("message:new", handleNewMessage);

    return () => {
      socket.emit("chat:leave", { chatId: activeChatId });
      socket.off("message:new", handleNewMessage);
    };
  }, [user, activeChatId]);

  // Фолбэк на поллинг, пока сокет не подключён.
  useEffect(() => {
    if (!user || !activeChatId || wsConnected) return;
    const interval = setInterval(() => {
      getChatMessages(activeChatId)
        .then(setMessages)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, activeChatId, wsConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleOpenChat(chatId: string) {
    setActiveChatId(chatId);
    setError(null);
    setLoadingMessages(true);
    getChatMessages(chatId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }

  function handleBack() {
    setActiveChatId(null);
    setMessages([]);
    reloadChats();
  }

  async function handleOpenSupport() {
    if (!supportContact) return;
    const existing = chats.find((c) => c.otherParticipant.id === supportContact.id);
    if (existing) {
      handleOpenChat(existing.id);
      return;
    }
    setOpeningSupport(true);
    try {
      const chat = await createChat(supportContact.id);
      reloadChats();
      handleOpenChat(chat.id);
    } catch {
      // Тихо — пункт «Поддержка» останется на месте, можно попробовать снова.
    } finally {
      setOpeningSupport(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeChatId) return;
    setError(null);

    const socket = getChatSocket();
    if (wsConnected && socket) {
      socket.emit("message:send", { chatId: activeChatId, text });
      setText("");
      return;
    }

    try {
      const sent = await sendChatMessageRest(activeChatId, text);
      mergeMessage(sent);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    }
  }

  // На страницах самого чата свой полноценный интерфейс уже есть —
  // не дублируем виджетом поверх него.
  if (!user || pathname?.startsWith("/chats")) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="card flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-xl">
          {activeChat ? (
            <>
              <div className="flex items-center gap-2 border-b border-black/10 p-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Назад к списку чатов"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                >
                  ←
                </button>
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  {activeChat.otherParticipant.avatarUrl && (
                    <Image
                      src={activeChat.otherParticipant.avatarUrl}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <span className="flex-1 truncate text-sm font-medium">
                  {participantName(activeChat.otherParticipant)}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Свернуть чат"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {loadingMessages ? (
                  <p className="text-sm text-zinc-500">Загрузка…</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {messages.map((msg) =>
                      msg.isSystem ? (
                        <div
                          key={msg.id}
                          className="self-center rounded-full bg-black/5 px-3 py-1 text-xs text-zinc-500 dark:bg-white/10"
                        >
                          {msg.text}
                        </div>
                      ) : (
                        <div
                          key={msg.id}
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            msg.senderId === user.id
                              ? "self-end bg-accent text-white"
                              : "self-start bg-black/5 dark:bg-white/10"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ),
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {error && <p className="px-3 text-xs text-red-600">{error}</p>}

              <form onSubmit={handleSubmit} className="flex gap-2 border-t border-black/10 p-2.5 dark:border-white/10">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Сообщение..."
                  maxLength={2000}
                  className="input h-9 flex-1 py-1.5 text-sm"
                />
                <button type="submit" className="btn-primary px-3.5 py-1.5 text-sm">
                  →
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-black/10 p-3 dark:border-white/10">
                <span className="text-sm font-medium">Чаты</span>
                <div className="flex items-center gap-2">
                  <Link href="/chats" className="text-xs text-accent-dark hover:underline">
                    Все чаты
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Свернуть чат"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[.04] dark:hover:bg-white/[.08]"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {supportContact && (
                  <button
                    type="button"
                    onClick={handleOpenSupport}
                    disabled={openingSupport}
                    className="flex w-full items-center gap-2.5 border-b border-black/10 bg-accent/10 p-3 text-left hover:bg-accent/20 disabled:opacity-60 dark:border-white/10"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3M4 13v6h3v-6H4a2 2 0 0 1 0 0m16 0a2 2 0 1 1 0 0"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">Поддержка</span>
                        {supportChat && supportChat.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-accent-foreground">
                            {supportChat.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                        {openingSupport
                          ? "Открываем…"
                          : (supportChat?.lastMessageText ?? "Есть вопрос — напишите нам")}
                      </p>
                    </div>
                  </button>
                )}
                {regularChats.length === 0 ? (
                  !supportContact && (
                    <p className="p-4 text-center text-sm text-zinc-500">Пока нет диалогов</p>
                  )
                ) : (
                  <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                    {regularChats.map((chat) => (
                      <li key={chat.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenChat(chat.id)}
                          className="flex w-full items-center gap-2.5 p-3 text-left hover:bg-black/[.02] dark:hover:bg-white/[.04]"
                        >
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                            {chat.otherParticipant.avatarUrl && (
                              <Image
                                src={chat.otherParticipant.avatarUrl}
                                alt=""
                                width={36}
                                height={36}
                                unoptimized
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {participantName(chat.otherParticipant)}
                              </span>
                              {chat.unreadCount > 0 && (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-white">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                            {chat.lastMessageText && (
                              <p className="truncate text-xs text-zinc-500">{chat.lastMessageText}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Свернуть чат" : "Открыть чат"}
        className="btn-primary relative flex h-14 w-14 items-center justify-center rounded-full p-0 shadow-lg"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          />
        </svg>
        {!open && unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium text-white">
            {unreadTotal}
          </span>
        )}
      </button>
    </div>
  );
}
