import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Service, ServiceStatus } from '../services/service.entity';
import { toPublicService } from '../services/services.service';
import { Favorite } from './favorite.entity';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoritesRepository: Repository<Favorite>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
  ) {}

  async add(userId: string, serviceId: string): Promise<Favorite> {
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId, status: ServiceStatus.ACTIVE },
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    try {
      return await this.favoritesRepository.save(
        this.favoritesRepository.create({ userId, serviceId }),
      );
    } catch (err) {
      // Повторное добавление в избранное — идемпотентно, не ошибка
      // (правка №5 в bookings.service.ts — тот же приём для partial index).
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
      ) {
        const existing = await this.favoritesRepository.findOne({
          where: { userId, serviceId },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  async remove(userId: string, serviceId: string): Promise<void> {
    await this.favoritesRepository.delete({ userId, serviceId });
  }

  async findIds(userId: string): Promise<string[]> {
    const favorites = await this.favoritesRepository.find({
      where: { userId },
      select: { serviceId: true },
    });
    return favorites.map((f) => f.serviceId);
  }

  async findServices(userId: string): Promise<Service[]> {
    const favorites = await this.favoritesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (favorites.length === 0) return [];

    const services = await this.servicesRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.images', 'images')
      .leftJoinAndSelect('service.category', 'category')
      .leftJoinAndSelect('service.seller', 'seller')
      .where('service.id IN (:...ids)', {
        ids: favorites.map((f) => f.serviceId),
      })
      .getMany();

    // Сохраняем порядок "недавно добавленные первыми" из favorites,
    // а не порядок, в котором Postgres вернул строки по IN (...).
    const byId = new Map(services.map((s) => [s.id, s]));
    return favorites
      .map((f) => byId.get(f.serviceId))
      .filter((s): s is Service => !!s)
      .map(toPublicService);
  }
}
