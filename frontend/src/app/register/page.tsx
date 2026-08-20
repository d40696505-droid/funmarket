"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, storeTokens, type UserRole } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const INTERESTS = ["Рыбалка", "Охота", "Путешествия", "Экскурсии", "Кулинария", "Ремесло"];

// Российский номер: +7/8 + 10 цифр, с необязательными пробелами/скобками/дефисами.
const RU_PHONE_PATTERN = "^(\\+7|8)[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}$";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("buyer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsOther, setInterestsOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await register({
        email,
        password,
        phone,
        role,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        interests: interests.length > 0 ? interests : undefined,
        interestsOther: interestsOther || undefined,
      });
      storeTokens(tokens);
      setUser(tokens.user);
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page py-10">
      <div className="glass-card max-w-md">
        <h1 className="mb-1 text-2xl font-bold">Регистрация</h1>
        <p className="mb-6 text-sm text-white/80">Создайте аккаунт, чтобы начать</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Пароль (мин. 8 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
          <input
            type="tel"
            required
            placeholder="+7 900 123-45-67"
            pattern={RU_PHONE_PATTERN}
            title="Российский номер в формате +7 900 123-45-67 или 8 900 123-45-67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="glass-input"
          />
          <input
            type="text"
            placeholder="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="glass-input"
          />
          <input
            type="text"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="glass-input"
          />

          <label className="flex flex-col gap-1 text-sm text-white/80">
            Роль
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="glass-input text-white [&>option]:text-black"
            >
              <option value="buyer">Покупатель</option>
              <option value="seller">Продавец</option>
              <option value="both">Обе роли</option>
            </select>
          </label>

          <div className="flex flex-col gap-1.5 text-sm text-white/80">
            <span>Что вам интересно?</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {INTERESTS.map((interest) => (
                <label key={interest} className="flex items-center gap-1.5 text-white">
                  <input
                    type="checkbox"
                    checked={interests.includes(interest)}
                    onChange={() => toggleInterest(interest)}
                    className="accent-[#8bc34a]"
                  />
                  {interest}
                </label>
              ))}
            </div>
            <input
              type="text"
              placeholder="Иное"
              value={interestsOther}
              onChange={(e) => setInterestsOther(e.target.value)}
              className="glass-input mt-1"
            />
          </div>

          {error && <p className="text-sm text-red-200">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full">
            {submitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/80">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-white underline">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
