import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoPoint, toGeoPoint } from './geo-point';

interface YandexGeocoderResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: { Point?: { pos?: string } };
      }>;
    };
  };
}

// Правка №12: только Yandex Geocoder для MVP (без мультипровайдерной абстракции).
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly configService: ConfigService) {}

  async geocode(address: string): Promise<GeoPoint | null> {
    const apiKey = this.configService.get<string>('YANDEX_GEOCODER_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'YANDEX_GEOCODER_API_KEY не задан — адрес сохранён без координат',
      );
      return null;
    }

    const url = new URL('https://geocode-maps.yandex.ru/1.x/');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('geocode', address);

    let data: YandexGeocoderResponse;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        this.logger.error(
          `Geocoder HTTP ${res.status} для адреса "${address}"`,
        );
        return null;
      }
      data = (await res.json()) as YandexGeocoderResponse;
    } catch (err) {
      this.logger.error(`Geocoder request failed: ${String(err)}`);
      return null;
    }

    const pos =
      data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point
        ?.pos;
    if (!pos) {
      return null;
    }

    const [lng, lat] = pos.split(' ').map(Number);
    return toGeoPoint(lat, lng);
  }
}
