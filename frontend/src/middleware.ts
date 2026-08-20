import { NextResponse, type NextRequest } from "next/server";

// Basic Auth поверх всего сайта — временная защита для публичного доступа
// по ссылке (демо через cloudflared-туннель), не для постоянного продакшена.
// Пропускает всё, если переменные не заданы (обычная локальная разработка).
export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const separatorIndex = decoded.indexOf(":");
      const providedUser = decoded.slice(0, separatorIndex);
      const providedPass = decoded.slice(separatorIndex + 1);
      if (providedUser === user && providedPass === pass) {
        return NextResponse.next();
      }
    } else if (scheme === "Bearer") {
      // Заголовок Authorization занят JWT-токеном самого сайта (вход в
      // аккаунт) — браузер не может одновременно слать и Basic, и Bearer
      // в одном запросе. Once пользователь получил JWT, значит он уже
      // прошёл Basic Auth раньше (иначе не смог бы залогиниться/зарегистрироваться
      // через тот же шлюз) — дальше пускаем, проверку делает сам JWT-гвард.
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FunMarket"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
