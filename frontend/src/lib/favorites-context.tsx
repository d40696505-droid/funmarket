"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { addFavorite, getFavoriteIds, removeFavorite } from "./api";
import { useAuth } from "./auth-context";

interface FavoritesContextValue {
  ids: Set<string>;
  toggle: (serviceId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.resolve()
      .then(() => (user ? getFavoriteIds() : []))
      .then((list) => setIds(new Set(list)))
      .catch(() => setIds(new Set()));
  }, [user]);

  function toggle(serviceId: string) {
    const wasFavorited = ids.has(serviceId);
    setIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });

    const request = wasFavorited ? removeFavorite(serviceId) : addFavorite(serviceId);
    request.catch(() => {
      // Некритичная фича — при ошибке молча откатываем сет.
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(serviceId);
        else next.delete(serviceId);
        return next;
      });
    });
  }

  return (
    <FavoritesContext.Provider value={{ ids, toggle }}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
