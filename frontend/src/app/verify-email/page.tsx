"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api";

function VerifyEmailStatus() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "loading") {
    return <p className="text-sm text-white/80">Подтверждаем email…</p>;
  }

  if (status === "success") {
    return (
      <p className="text-sm text-white/80">
        Email подтверждён.{" "}
        <Link href="/profile" className="font-medium text-white underline">
          Перейти в профиль
        </Link>
      </p>
    );
  }

  return (
    <p className="text-sm text-white/80">
      Ссылка недействительна или уже была использована. Если email всё ещё не
      подтверждён — напишите в поддержку через кнопку «Написать нам» в шапке
      сайта.
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="auth-page">
      <div className="glass-card">
        <h1 className="mb-6 text-2xl font-bold">Подтверждение email</h1>
        <Suspense fallback={<p className="text-sm text-white/80">Загрузка…</p>}>
          <VerifyEmailStatus />
        </Suspense>
      </div>
    </main>
  );
}
