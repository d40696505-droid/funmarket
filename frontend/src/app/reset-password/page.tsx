"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сбросить пароль");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-white/80">
        Ссылка недействительна — в ней нет токена сброса. Запросите новую на{" "}
        <Link href="/forgot-password" className="underline">
          странице восстановления пароля
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-white/80">
        Пароль изменён. Сейчас перенаправим на страницу входа…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="password"
        required
        minLength={8}
        placeholder="Новый пароль (мин. 8 символов)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="glass-input"
      />
      {error && <p className="text-sm text-red-200">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full">
        {submitting ? "Сохраняем…" : "Сохранить новый пароль"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <div className="glass-card">
        <h1 className="mb-6 text-2xl font-bold">Новый пароль</h1>
        <Suspense fallback={<p className="text-sm text-white/80">Загрузка…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
