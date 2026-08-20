import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

// Basic Auth поверх всего API — временная защита для публичного доступа
// по ссылке (демо через cloudflared-туннель), не для постоянного продакшена.
// Пропускает всё, если переменные не заданы (обычная локальная разработка).
function basicAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');
    const providedUser = decoded.slice(0, separatorIndex);
    const providedPass = decoded.slice(separatorIndex + 1);
    if (providedUser === user && providedPass === pass) {
      return next();
    }
  } else if (header?.startsWith('Bearer ')) {
    // Заголовок Authorization занят JWT самого сайта — браузер не может
    // одновременно слать Basic и Bearer в одном запросе. Раз есть JWT,
    // значит пользователь уже прошёл Basic Auth раньше (получить токен
    // можно только через тот же шлюз) — дальше проверяет JwtAuthGuard.
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="FunMarket"');
  res.status(401).send('Authentication required');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(basicAuthMiddleware);
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3002')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FunMarket API')
    .setDescription('C2C-маркетплейс развлекательных услуг')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
