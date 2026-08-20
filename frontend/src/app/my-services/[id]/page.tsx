"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ServiceForm, type ServiceFormValues } from "@/components/ServiceForm";
import {
  getMyServiceById,
  removeServiceImage,
  submitServiceForModeration,
  updateService,
  uploadServiceImageFile,
  type Service,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SERVICE_STATUS_LABEL } from "@/lib/service-status";

export default function EditServicePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    getMyServiceById(params.id)
      .then(setService)
      .catch((err) => setError(err instanceof Error ? err.message : "Услуга не найдена"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSubmit(values: ServiceFormValues) {
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const updated = await updateService(params.id, values);
      setService(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !service) return;

    setError(null);
    setUploading(true);
    try {
      const image = await uploadServiceImageFile(service.id, file);
      setService({ ...service, images: [...service.images, image] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleImageRemove(imageId: string) {
    if (!service) return;
    setError(null);
    try {
      await removeServiceImage(service.id, imageId);
      setService({ ...service, images: service.images.filter((i) => i.id !== imageId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить фото");
    }
  }

  async function handleSubmitForModeration() {
    if (!service) return;
    setError(null);
    try {
      const updated = await submitServiceForModeration(service.id);
      setService(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить на модерацию");
    }
  }

  if (authLoading || loading || !user) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  if (!service) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <p className="text-sm text-red-600">{error ?? "Услуга не найдена"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Редактирование услуги</h1>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">Статус: {SERVICE_STATUS_LABEL[service.status]}</p>
        <Link href={`/my-services/${service.id}/schedule`} className="text-sm underline">
          Расписание →
        </Link>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Фотографии ({service.images.length}/10)
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {service.images.map((image) => (
            <div key={image.id} className="group relative aspect-square">
              <Image
                src={image.url}
                alt=""
                fill
                unoptimized
                className="rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => handleImageRemove(image.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
          {service.images.length < 10 && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-black/20 text-xs text-zinc-500 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.08]">
              {uploading ? "…" : "+ Фото"}
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </section>

      {(service.status === "draft" || service.status === "inactive") && (
        <button
          type="button"
          onClick={handleSubmitForModeration}
          className="mb-6 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]"
        >
          Отправить на модерацию
        </button>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600">Сохранено</p>}

      <ServiceForm
        initial={service}
        submitting={submitting}
        submitLabel="Сохранить"
        onSubmit={handleSubmit}
      />
    </main>
  );
}
