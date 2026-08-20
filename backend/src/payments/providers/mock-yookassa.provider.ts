import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PaymentConfig } from '../payment-config';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

/**
 * Мок-провайдер по форме ЮKassa «Безопасная сделка»: create-payment -> редирект
 * на свою же страницу чекаута -> вебхук с HMAC-подписью, идемпотентный апдейт
 * по providerTransactionId. Реальных внешних вызовов не делает — учётных данных
 * юрлица/ИП у провайдера нет (docs/tz-amendments.md, п.1). Заменяется на
 * реального провайдера подстановкой другого класса под токеном PAYMENT_PROVIDER,
 * интерфейс менять не потребуется.
 */
@Injectable()
export class MockYookassaProvider implements PaymentProvider {
  constructor(private readonly paymentConfig: PaymentConfig) {}

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerTransactionId = `mock_yk_${randomUUID()}`;
    const redirectUrl = `${this.paymentConfig.frontendUrl}/checkout/${providerTransactionId}?bookingId=${input.bookingId}`;
    return Promise.resolve({ providerTransactionId, redirectUrl });
  }

  // Мок-специфичный метод, не часть PaymentProvider — реальный провайдер сам
  // подписывает свои вебхуки, нам нужно только verifyWebhookSignature. Здесь
  // нужен, потому что мок сам же и играет роль провайдера в checkout-эндпоинтах.
  sign(rawBody: string): string {
    return createHmac('sha256', this.paymentConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }

  verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined,
  ): boolean {
    if (!signature) return false;
    const expected = this.sign(rawBody);
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const actualBuf = Buffer.from(signature, 'hex');
      if (expectedBuf.length !== actualBuf.length) return false;
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }
}
