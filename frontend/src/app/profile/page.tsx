"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAccount,
  resendVerification,
  updateMe,
  uploadAvatarFile,
  type PublicUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CITIES } from "@/lib/cities";

export default function ProfilePage() {
  const { user, loading, setUser, logout } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleResendVerification() {
    setResending(true);
    setResendMessage(null);
    try {
      await resendVerification();
      setResendMessage("Письмо отправлено повторно — проверьте почту (и «Спам»).");
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : "Не удалось отправить письмо",
      );
    } finally {
      setResending(false);
    }
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Удалить аккаунт? Это действие необратимо: вход станет невозможен, личные данные будут стёрты. История бронирований и отзывов сохранится для других пользователей.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить аккаунт");
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarFile(file);
      const updated = await updateMe({ avatarUrl });
      setUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  if (loading || !user) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
        <p className="text-sm text-zinc-500">Загрузка…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Профиль</h1>
      <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
      <div className="mb-6">
        {!user.isEmailVerified && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p>
              Email не подтверждён. Мы отправили письмо со ссылкой на{" "}
              {user.email} при регистрации — если не пришло, проверьте папку
              «Спам».
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="mt-1.5 font-medium underline disabled:opacity-60"
            >
              {resending ? "Отправляем…" : "Отправить письмо ещё раз"}
            </button>
            {resendMessage && <p className="mt-1">{resendMessage}</p>}
          </div>
        )}
      </div>

      {(user.role === "seller" || user.role === "both") && (
        <Link
          href="/profile/balance"
          className="mb-6 -mt-2 inline-block text-sm text-accent-dark hover:underline"
        >
          Баланс и выплаты →
        </Link>
      )}

      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          {user.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt="Аватар"
              width={64}
              height={64}
              className="h-full w-full object-cover"
              unoptimized
            />
          )}
        </div>
        <label className="text-sm">
          <span className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.08]">
            {uploadingAvatar ? "Загрузка…" : "Изменить фото"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleAvatarChange}
            disabled={uploadingAvatar}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* key={user.id} держит форму несвязанной с последующими обновлениями
          user (например, после загрузки аватара) — иначе есть риск затереть
          несохранённый ввод пользователя */}
      <ProfileForm key={user.id} user={user} onSaved={setUser} />

      <div className="mt-10 border-t border-black/10 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="text-sm text-red-600 hover:underline disabled:opacity-60"
        >
          {deleting ? "Удаляем…" : "Удалить аккаунт"}
        </button>
      </div>
    </main>
  );
}

function ProfileForm({
  user,
  onSaved,
}: {
  user: PublicUser;
  onSaved: (user: PublicUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [brandName, setBrandName] = useState(user.brandName ?? "");
  const [sellerType, setSellerType] = useState(user.sellerType ?? "professional");
  const [skills, setSkills] = useState<string[]>(user.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleAddSkill() {
    const value = skillInput.trim();
    if (!value || skills.includes(value) || skills.length >= 20) return;
    setSkills((prev) => [...prev, value]);
    setSkillInput("");
  }

  function handleRemoveSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const updated = await updateMe({
        firstName,
        lastName,
        city,
        bio,
        brandName,
        sellerType:
          user.role === "seller" || user.role === "both" ? sellerType : undefined,
        skills: user.role === "seller" || user.role === "both" ? skills : undefined,
      });
      onSaved(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Имя</span>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Фамилия</span>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Город</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          list="cities-datalist"
          placeholder="Начните вводить город"
          className="input"
        />
        <datalist id="cities-datalist">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {city && !(CITIES as readonly string[]).includes(city) && (
          <span className="text-xs text-zinc-500">
            Города нет в списке — сохранится, но его проверит модератор
          </span>
        )}
      </label>
      {(user.role === "seller" || user.role === "both") && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Название студии/бренда (необязательно)
            </span>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">О себе</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="input"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Тип продавца</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="sellerType"
                  checked={sellerType === "private"}
                  onChange={() => setSellerType("private")}
                />
                Частный мастер
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="sellerType"
                  checked={sellerType === "professional"}
                  onChange={() => setSellerType("professional")}
                />
                Профессионал
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Умения (например: ловить рыбу нахлыстом, ковать ножи)
            </span>
            <div className="flex gap-2">
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Например: сажать яблони"
                className="input flex-1"
              />
              <button type="button" onClick={handleAddSkill} className="btn-secondary">
                Добавить
              </button>
            </div>
            {skills.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-xs dark:bg-white/10"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-zinc-500 hover:text-red-600"
                      aria-label={`Убрать «${skill}»`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Сохранено</p>}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary mt-2"
      >
        {submitting ? "Сохраняем…" : "Сохранить"}
      </button>
    </form>
  );
}
