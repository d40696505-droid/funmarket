"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getChatMessages,
  reportMessage,
  sendChatMessageRest,
  type ChatMessage,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getChatSocket } from "@/lib/socket";

const POLL_INTERVAL_MS = 4000;
const WS_CONNECT_TIMEOUT_MS = 3000;

export default function ChatConversationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const chatId = params.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function mergeMessage(msg: ChatMessage) {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }

  // Начальная загрузка истории (и отметка прочитанным на бэкенде).
  useEffect(() => {
    if (!user) return;
    Promise.resolve()
      .then(() => getChatMessages(chatId))
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [chatId, user]);

  function notifyBrowser(msg: ChatMessage) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (notifiedIds.current.has(msg.id)) return;
    notifiedIds.current.add(msg.id);
    new Notification("Новое сообщение", { body: msg.text });
  }

  // WebSocket: подключение, join комнаты чата, приём сообщений в реальном времени.
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
      socket?.emit("chat:join", { chatId });
    }
    function handleDisconnect() {
      setWsConnected(false);
    }
    function handleNewMessage(msg: ChatMessage) {
      if (msg.chatId !== chatId) return;
      mergeMessage(msg);
      if (document.hidden && msg.senderId !== user?.id) {
        notifyBrowser(msg);
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:new", handleNewMessage);
    if (socket.connected) handleConnect();

    return () => {
      if (connectTimeout) clearTimeout(connectTimeout);
      socket.emit("chat:leave", { chatId });
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:new", handleNewMessage);
    };
  }, [chatId, user]);

  // Fallback на polling (FR-6.2), пока WebSocket не подключён.
  useEffect(() => {
    if (!user || wsConnected) return;
    const interval = setInterval(() => {
      getChatMessages(chatId)
        .then((fresh) => setMessages(fresh))
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [chatId, user, wsConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);

    const socket = getChatSocket();
    if (wsConnected && socket) {
      socket.emit("message:send", { chatId, text });
      setText("");
      return;
    }

    try {
      const sent = await sendChatMessageRest(chatId, text);
      mergeMessage(sent);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
    }
  }

  async function handleReport(messageId: string) {
    const reason = prompt("Причина жалобы:");
    if (!reason) return;
    try {
      await reportMessage(messageId, reason);
      alert("Жалоба отправлена");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось отправить жалобу");
    }
  }

  if (authLoading || loading || !user) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Диалог</h1>
        <span className="text-xs text-zinc-500">
          {wsConnected ? "● online" : "○ обновление раз в неск. секунд"}
        </span>
      </div>

      <div className="card flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {messages.map((msg) =>
            msg.isSystem ? (
              <div key={msg.id} className="self-center rounded-full bg-black/5 px-3 py-1 text-xs text-zinc-500 dark:bg-white/10">
                {msg.text}
              </div>
            ) : (
              <div
                key={msg.id}
                className={`group max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  msg.senderId === user.id
                    ? "self-end bg-accent text-white"
                    : "self-start bg-black/5 dark:bg-white/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.senderId !== user.id && (
                  <button
                    onClick={() => handleReport(msg.id)}
                    className="mt-1 text-xs opacity-0 underline group-hover:opacity-60"
                  >
                    Пожаловаться
                  </button>
                )}
              </div>
            ),
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение..."
          maxLength={2000}
          className="input flex-1"
        />
        <button
          type="submit"
          className="btn-primary"
        >
          Отправить
        </button>
      </form>
    </main>
  );
}
