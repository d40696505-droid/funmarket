import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

// Вызывается "провайдером" (в этом моке — checkout-эндпоинтом, играющим роль
// ЮKassa), без JwtAuthGuard — аутентичность гарантирует HMAC-подпись
// (amendment #7), не JWT.
@ApiExcludeController()
@Controller('api/payments/webhook')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mock-yookassa')
  async handle(
    @Body() body: Record<string, unknown>,
    @Headers('x-payment-signature') signature?: string,
  ) {
    const rawBody = JSON.stringify(body);
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
