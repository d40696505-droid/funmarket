"use client";

import Link from "next/link";
import { useEffect } from "react";

export function AuthRequiredModal({
  onClose,
  message = "Чтобы отправить запрос продавцу, нужно войти в аккаунт или зарегистрироваться.",
}: {
  onClose: () => void;
  message?: string;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold">Войдите в аккаунт</h2>
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        <div className="flex flex-col gap-2">
          <Link href="/login" className="btn-primary w-full">
            Войти
          </Link>
          <Link href="/register" className="btn-secondary w-full">
            Зарегистрироваться
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-zinc-500 hover:underline"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
