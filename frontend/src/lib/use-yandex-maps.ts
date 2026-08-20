"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      Map: new (element: HTMLElement, state: object) => YandexMap;
      Placemark: new (
        coords: [number, number],
        properties?: object,
        options?: object,
      ) => YandexPlacemark;
      Clusterer: new (options?: object) => YandexClusterer;
    };
  }
}

export interface YandexEvent {
  get: (key: string) => unknown;
}

export interface YandexPlacemark {
  events: { add: (event: string, handler: (e: YandexEvent) => void) => void };
  options: { set: (key: string, value: unknown) => void };
}

export interface YandexClusterer {
  add: (objects: YandexPlacemark[]) => void;
}

export interface YandexMap {
  geoObjects: { add: (object: YandexClusterer) => void; removeAll: () => void };
  setCenter: (coords: [number, number], zoom?: number) => void;
}

let loadPromise: Promise<void> | null = null;

function loadYandexMapsScript(apiKey: string): Promise<void> {
  if (window.ymaps) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
      script.async = true;
      script.onload = () => window.ymaps!.ready(() => resolve());
      script.onerror = () => reject(new Error("Не удалось загрузить Yandex Maps"));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

export function useYandexMaps(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    Promise.resolve()
      .then(() => {
        if (!apiKey) {
          throw new Error("Карта не настроена: нет NEXT_PUBLIC_YANDEX_MAPS_API_KEY");
        }
        return loadYandexMapsScript(apiKey);
      })
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки карты"));
  }, []);

  return { ready, error };
}
