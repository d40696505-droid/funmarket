import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/category.entity';
import { GeocodingService } from '../geocoding/geocoding.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { SearchServicesDto, ServiceSortBy } from './dto/search-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import {
  assertValidLocation,
  assertValidPricing,
} from './service-business-rules';
import { ServiceImage } from './service-image.entity';
import {
  Service,
  ServiceBookingMode,
  ServiceLocationType,
  ServicePriceType,
  ServiceStatus,
} from './service.entity';
import { toProfileSummary } from '../users/public-user.mapper';

// Публичные ответы (каталог, карточка услуги) не должны отдавать email/телефон
// продавца — только для админ-очереди модерации (findPendingModeration)
// это не применяется, там нужен полный контакт.
export function toPublicService(service: Service): Service {
  if (!service.seller) {
    return service;
  }
  return {
    ...service,
    seller: toProfileSummary(service.seller) as unknown as Service['seller'],
  };
}

export interface ServiceMapMarker {
  id: string;
  title: string;
  priceMin: number | null;
  priceType: string;
  categoryName: string;
  sellerRating: number;
  sellerReviewsCount: number;
  previewUrl: string | null;
  lat: number;
  lng: number;
}

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    @InjectRepository(ServiceImage)
    private readonly serviceImagesRepository: Repository<ServiceImage>,
    private readonly categoriesService: CategoriesService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async create(sellerId: string, dto: CreateServiceDto): Promise<Service> {
    const category = await this.categoriesService.findById(dto.categoryId);
    if (!category) {
      throw new BadRequestException('Категория не найдена');
    }

    assertValidPricing(
      dto.priceType,
      dto.priceMin ?? null,
      dto.priceMax ?? null,
    );
    assertValidLocation(
      dto.locationType,
      dto.locationAddress ?? null,
      dto.travelRadiusKm ?? null,
    );

    const locationPoint =
      dto.locationType !== ServiceLocationType.ONLINE && dto.locationAddress
        ? await this.geocodingService.geocode(dto.locationAddress)
        : null;

    const service = this.servicesRepository.create({
      sellerId,
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      priceType: dto.priceType,
      priceMin: this.toNumericOrNull(dto.priceMin),
      priceMax: this.toNumericOrNull(this.resolvePriceMax(dto)),
      priceUnit: dto.priceUnit,
      durationMinutes: dto.durationMinutes,
      locationType: dto.locationType,
      locationAddress: dto.locationAddress ?? null,
      locationPoint,
      city: dto.city,
      travelRadiusKm: this.toNumericOrNull(dto.travelRadiusKm),
      tags: dto.tags ?? [],
      bookingMode: dto.bookingMode ?? ServiceBookingMode.SLOTS,
      capacity: dto.capacity ?? 1,
      status: ServiceStatus.DRAFT,
    });

    return this.servicesRepository.save(service);
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.getOwnedOrThrow(id, sellerId);

    if (dto.categoryId) {
      const category = await this.categoriesService.findById(dto.categoryId);
      if (!category) {
        throw new BadRequestException('Категория не найдена');
      }
    }

    const priceType = dto.priceType ?? service.priceType;
    const priceMin = dto.priceMin ?? this.toNumberOrNull(service.priceMin);
    const priceMax = this.resolvePriceMax(
      { ...dto, priceType },
      priceMin,
      service,
    );
    assertValidPricing(priceType, priceMin, priceMax);

    const locationType = dto.locationType ?? service.locationType;
    const locationAddress = dto.locationAddress ?? service.locationAddress;
    const travelRadiusKm =
      dto.travelRadiusKm ?? this.toNumberOrNull(service.travelRadiusKm);
    assertValidLocation(locationType, locationAddress, travelRadiusKm);

    const addressChanged =
      dto.locationAddress !== undefined || dto.locationType !== undefined;
    const locationPoint =
      locationType !== ServiceLocationType.ONLINE
        ? addressChanged && locationAddress
          ? await this.geocodingService.geocode(locationAddress)
          : service.locationPoint
        : null;

    Object.assign(service, {
      ...dto,
      priceType,
      priceMin: this.toNumericOrNull(priceMin),
      priceMax: this.toNumericOrNull(priceMax),
      locationType,
      locationAddress,
      locationPoint,
      travelRadiusKm: this.toNumericOrNull(travelRadiusKm),
    });

    return this.servicesRepository.save(service);
  }

  async submitForModeration(id: string, sellerId: string): Promise<Service> {
    const service = await this.getOwnedOrThrow(id, sellerId);

    if (
      service.status !== ServiceStatus.DRAFT &&
      service.status !== ServiceStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'На модерацию можно отправить только черновик или неактивное объявление',
      );
    }

    const imagesCount = await this.serviceImagesRepository.count({
      where: { serviceId: id },
    });
    if (imagesCount < 1) {
      throw new BadRequestException(
        'Нужна хотя бы одна фотография перед отправкой на модерацию',
      );
    }

    service.status = ServiceStatus.MODERATION;
    service.moderationComment = null;
    return this.servicesRepository.save(service);
  }

  async deactivate(id: string, sellerId: string): Promise<Service> {
    const service = await this.getOwnedOrThrow(id, sellerId);
    service.status = ServiceStatus.INACTIVE;
    return this.servicesRepository.save(service);
  }

  async activate(id: string, sellerId: string): Promise<Service> {
    const service = await this.getOwnedOrThrow(id, sellerId);
    if (service.status !== ServiceStatus.INACTIVE) {
      throw new BadRequestException(
        'Активировать можно только ранее одобренное объявление',
      );
    }
    service.status = ServiceStatus.ACTIVE;
    return this.servicesRepository.save(service);
  }

  async delete(id: string, sellerId: string): Promise<void> {
    const service = await this.getOwnedOrThrow(id, sellerId);
    await this.servicesRepository.remove(service);
  }

  async findMine(sellerId: string): Promise<Service[]> {
    return this.servicesRepository.find({
      where: { sellerId },
      relations: { images: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findMineById(id: string, sellerId: string): Promise<Service> {
    return this.getOwnedOrThrow(id, sellerId);
  }

  async search(dto: SearchServicesDto): Promise<{
    items: Service[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.servicesRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.images', 'images')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('service.seller', 'seller');
    const hasPoint = this.applyFilters(qb, dto);

    switch (dto.sortBy) {
      case ServiceSortBy.PRICE:
        qb.orderBy('service.priceMin', dto.sortOrder ?? 'ASC', 'NULLS LAST');
        break;
      case ServiceSortBy.RATING:
        qb.orderBy('seller.rating', dto.sortOrder ?? 'DESC');
        break;
      case ServiceSortBy.DISTANCE:
        if (hasPoint) {
          qb.addSelect(
            'ST_Distance(service."locationPoint", ST_MakePoint(:lng, :lat)::geography)',
            'distance',
          ).orderBy('distance', 'ASC');
        } else {
          qb.orderBy('service.createdAt', 'DESC');
        }
        break;
      default:
        qb.orderBy('service.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(toPublicService), total, page, limit };
  }

  // Карусели по категориям на главной. Одна выборка на категорию (не одна
  // выборка на весь сайт — на такой малой ширине каталога это не проблема
  // производительности), но всё за один HTTP-запрос с фронтенда, без
  // отдельного COUNT на каждую категорию, в отличие от N вызовов search().
  // "Иное" — общая категория-корзина, показываем её последней.
  async findHomeCarousels(
    limitPerCategory = 8,
  ): Promise<{ category: Category; services: Service[] }[]> {
    const categories = await this.categoriesService.findAll();
    const ordered = [...categories].sort(
      (a, b) => (a.slug === 'other' ? 1 : 0) - (b.slug === 'other' ? 1 : 0),
    );

    const results = await Promise.all(
      ordered.map(async (category) => {
        const services = await this.servicesRepository
          .createQueryBuilder('service')
          .leftJoinAndSelect('service.images', 'images')
          .leftJoinAndSelect('service.category', 'category')
          .leftJoinAndSelect('service.seller', 'seller')
          .where('service.categoryId = :categoryId', {
            categoryId: category.id,
          })
          .andWhere('service.status = :status', {
            status: ServiceStatus.ACTIVE,
          })
          .orderBy('service.createdAt', 'DESC')
          .take(limitPerCategory)
          .getMany();
        return { category, services: services.map(toPublicService) };
      }),
    );
    return results.filter((r) => r.services.length > 0);
  }

  // Данные для маркеров карты (FR-3.1): тот же набор фильтров, что и в
  // search(), но лёгкий payload + координаты, извлечённые через ST_X/ST_Y
  // (сырые geography-значения не гидратируются TypeORM в JS-объект).
  async findMapMarkers(dto: SearchServicesDto): Promise<ServiceMapMarker[]> {
    const qb = this.servicesRepository
      .createQueryBuilder('service')
      .leftJoin('service.category', 'category')
      .leftJoin('service.seller', 'seller');
    this.applyFilters(qb, dto);

    qb.andWhere('service."locationPoint" IS NOT NULL')
      .select('service.id', 'id')
      .addSelect('service.title', 'title')
      .addSelect('service.priceMin', 'priceMin')
      .addSelect('service.priceType', 'priceType')
      .addSelect('category.name', 'categoryName')
      .addSelect('seller.rating', 'sellerRating')
      .addSelect('seller.reviewsCount', 'sellerReviewsCount')
      .addSelect('ST_Y(service."locationPoint"::geometry)', 'lat')
      .addSelect('ST_X(service."locationPoint"::geometry)', 'lng')
      .addSelect(
        `(SELECT i.url FROM service_images i WHERE i."serviceId" = service.id ORDER BY i."sortOrder" ASC LIMIT 1)`,
        'previewUrl',
      )
      .limit(500); // NFR 5.1: карта рендерит до 500 маркеров без деградации

    const rows = await qb.getRawMany<{
      id: string;
      title: string;
      priceMin: string | null;
      priceType: string;
      categoryName: string;
      sellerRating: string;
      sellerReviewsCount: string;
      previewUrl: string | null;
      lat: string;
      lng: string;
    }>();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceMin: row.priceMin != null ? Number(row.priceMin) : null,
      priceType: row.priceType,
      categoryName: row.categoryName,
      sellerRating: Number(row.sellerRating),
      sellerReviewsCount: Number(row.sellerReviewsCount),
      previewUrl: row.previewUrl,
      lat: Number(row.lat),
      lng: Number(row.lng),
    }));
  }

  private applyFilters(
    qb: SelectQueryBuilder<Service>,
    dto: SearchServicesDto,
  ): boolean {
    qb.where('service.status = :status', { status: ServiceStatus.ACTIVE });

    if (dto.q) {
      qb.andWhere(
        `to_tsvector('russian', coalesce(service.title, '') || ' ' || coalesce(service.description, '')) ` +
          `@@ plainto_tsquery('russian', :q)`,
        { q: dto.q },
      );
    }

    if (dto.categoryId) {
      qb.andWhere('service.categoryId = :categoryId', {
        categoryId: dto.categoryId,
      });
    }

    if (dto.sellerId) {
      qb.andWhere('service.sellerId = :sellerId', { sellerId: dto.sellerId });
    }

    if (dto.priceMin != null) {
      qb.andWhere(
        '(service.priceMax IS NULL OR service.priceMax >= :priceMinFilter)',
        { priceMinFilter: dto.priceMin },
      );
    }

    if (dto.priceMax != null) {
      qb.andWhere(
        '(service.priceMin IS NULL OR service.priceMin <= :priceMaxFilter)',
        { priceMaxFilter: dto.priceMax },
      );
    }

    if (dto.minRating != null) {
      qb.andWhere('seller.rating >= :minRating', {
        minRating: dto.minRating,
      });
    }

    if (dto.city) {
      qb.andWhere('service.city = :city', { city: dto.city });
    }

    const hasPoint = dto.lat != null && dto.lng != null;
    if (hasPoint) {
      qb.setParameters({ lat: dto.lat, lng: dto.lng });
    }
    if (hasPoint && dto.radiusKm != null) {
      qb.andWhere(
        `ST_DWithin(service."locationPoint", ST_MakePoint(:lng, :lat)::geography, :radiusMeters)`,
        { radiusMeters: dto.radiusKm * 1000 },
      );
    }

    return hasPoint;
  }

  findPendingModeration(): Promise<Service[]> {
    return this.servicesRepository.find({
      where: { status: ServiceStatus.MODERATION },
      relations: { images: true, category: true, seller: true },
      order: { createdAt: 'ASC' },
    });
  }

  async approve(id: string): Promise<Service> {
    const service = await this.findByIdOrThrow(id);
    if (service.status !== ServiceStatus.MODERATION) {
      throw new BadRequestException('Услуга не находится на модерации');
    }
    service.status = ServiceStatus.ACTIVE;
    service.moderationComment = null;
    return this.servicesRepository.save(service);
  }

  async reject(id: string, comment: string): Promise<Service> {
    const service = await this.findByIdOrThrow(id);
    if (service.status !== ServiceStatus.MODERATION) {
      throw new BadRequestException('Услуга не находится на модерации');
    }
    // Возвращаем в черновик — продавец правит и отправляет повторно.
    service.status = ServiceStatus.DRAFT;
    service.moderationComment = comment;
    return this.servicesRepository.save(service);
  }

  async findPublicById(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({
      where: { id, status: ServiceStatus.ACTIVE },
      relations: { images: true, category: true, seller: true },
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    await this.servicesRepository.increment({ id }, 'viewsCount', 1);
    return toPublicService(service);
  }

  async addImage(
    serviceId: string,
    sellerId: string,
    url: string,
  ): Promise<ServiceImage> {
    const service = await this.getOwnedOrThrow(serviceId, sellerId);
    if (service.images.length >= 10) {
      throw new BadRequestException('Максимум 10 фотографий на услугу');
    }

    const image = this.serviceImagesRepository.create({
      serviceId,
      url,
      sortOrder: service.images.length,
    });
    return this.serviceImagesRepository.save(image);
  }

  async removeImage(
    serviceId: string,
    sellerId: string,
    imageId: string,
  ): Promise<void> {
    await this.getOwnedOrThrow(serviceId, sellerId);
    await this.serviceImagesRepository.delete({ id: imageId, serviceId });
  }

  private async findByIdOrThrow(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    return service;
  }

  private async getOwnedOrThrow(
    id: string,
    sellerId: string,
  ): Promise<Service> {
    const service = await this.servicesRepository.findOne({
      where: { id },
      relations: { images: true },
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    if (service.sellerId !== sellerId) {
      throw new ForbiddenException('Нет доступа к этой услуге');
    }
    return service;
  }

  private resolvePriceMax(
    dto: Pick<CreateServiceDto, 'priceType' | 'priceMin' | 'priceMax'>,
    fallbackMin?: number | null,
    existing?: Service,
  ): number | null {
    if (dto.priceType === ServicePriceType.NEGOTIABLE) {
      return null;
    }
    if (dto.priceType === ServicePriceType.FIXED) {
      return dto.priceMin ?? fallbackMin ?? null;
    }
    return dto.priceMax ?? this.toNumberOrNull(existing?.priceMax ?? null);
  }

  private toNumericOrNull(value: number | null | undefined): string | null {
    return value == null ? null : String(value);
  }

  private toNumberOrNull(value: string | null | undefined): number | null {
    return value == null ? null : Number(value);
  }
}
