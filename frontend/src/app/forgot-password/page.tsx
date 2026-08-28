"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      // Бэкенд намеренно всегда отвечает одинаково, существует email или
      // нет — не даём перечислять зарегистрированные адреса.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить запрос");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="glass-card">
        <h1 className="mb-1 text-2xl font-bold">Восстановление пароля</h1>

        {sent ? (
          <p className="text-sm text-white/80">
            Если такой email зарегистрирован — на него отправлена ссылка для
            сброса пароля. Проверьте почту.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-white/80">
              Укажите email, привязанный к аккаунту — пришлём ссылку для сброса
              пароля.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
              />
              {error && <p className="text-sm text-red-200">{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full">
                {submitting ? "Отправляем…" : "Отправить ссылку"}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-sm text-white/80">
          <Link href="/login" className="font-medium text-white underline">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </main>
  );
}
