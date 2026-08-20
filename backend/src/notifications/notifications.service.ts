import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly mailService: MailService,
  ) {}

  async notify(
    user: Pick<User, 'id' | 'email'>,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId: user.id,
      type,
      title,
      body,
      data: data ?? null,
    });
    const saved = await this.notificationsRepository.save(notification);
    await this.mailService.send(user.email, title, body);
    return saved;
  }

  findMine(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Уведомление не найдено');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Нет доступа к этому уведомлению');
    }
    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }
}
