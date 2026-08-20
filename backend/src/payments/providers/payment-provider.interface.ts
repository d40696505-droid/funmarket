export interface CreatePaymentInput {
  bookingId: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
}

export interface CreatePaymentResult {
  providerTransactionId: string;
  redirectUrl: string;
}

// Точка замены на реального провайдера (ЮKassa «Безопасная сделка») — реализация
// меняется, вызовы из PaymentsService нет.
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhookSignature(
    rawBody: string,
    signature: string | undefined,
  ): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
