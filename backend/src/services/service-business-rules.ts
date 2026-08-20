import { BadRequestException } from '@nestjs/common';
import { ServiceLocationType, ServicePriceType } from './service.entity';

export function assertValidPricing(
  priceType: ServicePriceType,
  priceMin: number | null,
  priceMax: number | null,
): void {
  if (priceType === ServicePriceType.NEGOTIABLE) {
    return;
  }
  if (priceMin == null) {
    throw new BadRequestException(
      'priceMin обязателен, если цена не "по договорённости"',
    );
  }
  if (priceType === ServicePriceType.RANGE) {
    if (priceMax == null) {
      throw new BadRequestException(
        'priceMax обязателен для типа цены "от-до"',
      );
    }
    if (priceMax < priceMin) {
      throw new BadRequestException('priceMax не может быть меньше priceMin');
    }
  }
}

export function assertValidLocation(
  locationType: ServiceLocationType,
  locationAddress: string | null,
  travelRadiusKm: number | null,
): void {
  if (locationType !== ServiceLocationType.ONLINE && !locationAddress) {
    throw new BadRequestException(
      'locationAddress обязателен, если локация не "онлайн"',
    );
  }
  if (locationType === ServiceLocationType.MOBILE && travelRadiusKm == null) {
    throw new BadRequestException(
      'travelRadiusKm обязателен для локации "выезд к клиенту"',
    );
  }
}
