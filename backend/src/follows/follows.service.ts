import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { NotificationType } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { Service } from '../services/service.entity';
import { User } from '../users/user.entity';
import { toProfileSummary } from '../users/public-user.mapper';
import { Follow } from './follow.entity';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async follow(followerId: string, sellerId: string): Promise<void> {
    if (followerId === sellerId) {
      throw new BadRequestException('Нельзя подписаться на самого себя');
    }
    const seller = await this.usersRepository.findOne({
      where: { id: sellerId, isDeleted: false },
    });
    if (!seller) {
      throw new NotFoundException('Продавец не найден');
    }
    try {
      await this.followsRepository.save(
        this.followsRepository.create({ followerId, sellerId }),
      );
    } catch (err) {
      // Повторная подписка идемпотентна, как и добавление в избранное.
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
      ) {
        return;
      }
      throw err;
    }
  }

  async unfollow(followerId: string, sellerId: string): Promise<void> {
    await this.followsRepository.delete({ followerId, sellerId });
  }

  async findIds(followerId: string): Promise<string[]> {
    const follows = await this.followsRepository.find({
      where: { followerId },
      select: { sellerId: true },
    });
    return follows.map((f) => f.sellerId);
  }

  async findSellers(followerId: string) {
    const follows = await this.followsRepository.find({
      where: { followerId },
      relations: { seller: true },
      order: { createdAt: 'DESC' },
    });
    return follows.filter((f) => !f.seller.isDeleted).map((f) => toProfileSummary(f.seller));
  }

  countFollowers(sellerId: string): Promise<number> {
    return this.followsRepository.count({ where: { sellerId } });
  }

  // Вызывается при публикации услуги (одобрение модератором). Сбой уведомлений
  // не должен ломать саму публикацию, поэтому ошибки только логируются.
  async notifyFollowersOfNewService(service: Service): Promise<void> {
    try {
      const follows = await this.followsRepository.find({
        where: { sellerId: service.sellerId },
        relations: { follower: true, seller: true },
      });
      for (const follow of follows) {
        const name =
          follow.seller.brandName ||
          [follow.seller.firstName, follow.seller.lastName]
            .filter(Boolean)
            .join(' ') ||
          'Продавец';
        await this.notificationsService.notify(
          follow.follower,
          NotificationType.SELLER_NEW_SERVICE,
          'Новая услуга у продавца',
          `${name} опубликовал(а) новую услугу «${service.title}»`,
          { serviceId: service.id, sellerId: service.sellerId },
        );
      }
    } catch (err) {
      this.logger.error(`Не удалось уведомить подписчиков: ${String(err)}`);
    }
  }
}
