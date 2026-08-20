"use client";

import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export function getChatSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  if (!socket) {
    // Пустая строка (относительный API_URL за rewrite-прокси) — не валидный
    // URL для io(), нужен undefined, чтобы socket.io-client сам взял origin
    // текущей страницы.
    socket = io(API_URL || undefined, {
      path: "/ws/chat",
      auth: { token },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
}
