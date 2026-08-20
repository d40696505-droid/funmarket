import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next dev блокирует кросс-origin запросы к /_next/* по умолчанию — нужно
  // явно разрешить домен туннеля (cloudflared quick tunnel), иначе статика
  // отдаёт 403 при заходе не с localhost. Wildcard — чтобы не перебивать
  // конфиг при каждом перезапуске туннеля (поддомен меняется).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Проксируем API на бэкенд тем же origin'ом, что и сама страница — иначе
  // фронтенд и бэкенд живут на двух разных доменах туннеля, и Basic Auth,
  // введённый браузером для одного домена, не подхватывается на втором
  // (плюс лишний CORS-preflight). Через rewrite браузер видит только один
  // origin, все /api/* запросы уходят туда же и проксируются сюда сервером.
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:3000/api/:path*" }];
  },
};

export default nextConfig;
