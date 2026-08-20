import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Собирает все PAYMENT_*-чтения в одном месте, чтобы расчёт комиссии не мог
// разойтись между PaymentsService и мок-провайдером (см. docs/tz-amendments.md, §7).
@Injectable()
export class PaymentConfig {
  constructor(private readonly config: ConfigService) {}

  get commissionPercent(): number {
    return Number(this.config.get('PAYMENT_COMMISSION_PERCENT', '10'));
  }

  get escrowReleaseHours(): number {
    return Number(this.config.get('PAYMENT_ESCROW_RELEASE_HOURS', '48'));
  }

  get webhookSecret(): string {
    return this.config.get<string>(
      'PAYMENT_WEBHOOK_SECRET',
      'dev-webhook-secret',
    );
  }

  get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3002');
  }
}
