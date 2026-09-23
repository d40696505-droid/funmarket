import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SubscriptionDto {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;
  readonly publicKey: string;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionsRepository: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {
    this.publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY', '');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY', '');
    const subject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:support@hobbyhub.ru',
    );

    this.enabled = Boolean(this.publicKey && privateKey);
    if (this.enabled) {
      webpush.setVapidDetails(subject, this.publicKey, privateKey);
    } else {
      this.logger.warn(
        'VAPID-ключи не заданы (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) — push-уведомления отключены',
      );
    }
  }

  async subscribe(userId: string, dto: SubscriptionDto): Promise<void> {
    const existing = await this.subscriptionsRepository.findOne({
      where: { endpoint: dto.endpoint },
    });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      await this.subscriptionsRepository.save(existing);
      return;
    }
    await this.subscriptionsRepository.save(
      this.subscriptionsRepository.create({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionsRepository.delete({ userId, endpoint });
  }

  // Фоново, не блокирует вызывающий код (тот же паттерн, что почта —
  // сбой push не должен ронять основной запрос).
  sendToUser(userId: string, payload: PushPayload): void {
    if (!this.enabled) return;
    this.subscriptionsRepository
      .find({ where: { userId } })
      .then((subs) => {
        for (const sub of subs) {
          webpush
            .sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify(payload),
            )
            .catch((err: { statusCode?: number }) => {
              // 404/410 — подписка больше не действительна (юзер отозвал
              // разрешение / браузер её сбросил), чистим за собой.
              if (err.statusCode === 404 || err.statusCode === 410) {
                void this.subscriptionsRepository.delete({ id: sub.id });
                return;
              }
              this.logger.error(
                `Не удалось отправить push пользователю ${userId}`,
                String(err),
              );
            });
        }
      })
      .catch((err) => {
        this.logger.error('Не удалось загрузить push-подписки', String(err));
      });
  }
}
