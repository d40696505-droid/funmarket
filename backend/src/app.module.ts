import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule as CronModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatsModule } from './chats/chats.module';
import { FavoritesModule } from './favorites/favorites.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ServicesModule } from './services/services.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    CronModule.forRoot(),
    // NFR 5.3: общий лимит 300 запросов/мин на пользователя (IP на MVP) —
    // поднят со 100 после нагрузочного тестирования: 100/мин на IP слишком
    // строго для публичных read-эндпоинтов (несколько параллельных запросов
    // на загрузку страницы + общий IP у пользователей за NAT/офисной сетью).
    // Более строгий лимит для auth-эндпоинтов задан через @Throttle в AuthController.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    UploadsModule,
    CategoriesModule,
    ServicesModule,
    ScheduleModule,
    BookingsModule,
    NotificationsModule,
    ChatsModule,
    ReviewsModule,
    PaymentsModule,
    FavoritesModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'hobbyhub'),
        password: config.get<string>('DB_PASSWORD', 'hobbyhub'),
        database: config.get<string>('DB_NAME', 'hobbyhub'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
