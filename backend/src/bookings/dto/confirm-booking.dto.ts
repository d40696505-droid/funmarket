import { IsNumberString, IsOptional } from 'class-validator';

// Обязателен только для брони по услуге с договорной ценой (totalAmount ещё
// не проставлен) — продавец фиксирует итоговую сумму в момент подтверждения.
export class ConfirmBookingDto {
  @IsOptional()
  @IsNumberString()
  fixedAmount?: string;
}
