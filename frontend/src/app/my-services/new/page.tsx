"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ServiceForm, type ServiceFormValues } from "@/components/ServiceForm";
import { createService } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function NewServicePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  async function handleSubmit(values: ServiceFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const service = await createService(values);
      router.push(`/my-services/${service.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать услугу");
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Новая услуга</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <ServiceForm submitting={submitting} submitLabel="Создать" onSubmit={handleSubmit} />
    </main>
  );
}
