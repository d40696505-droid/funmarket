import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import { User } from '../users/user.entity';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
    private readonly configService: ConfigService,
  ) {}

  // Демо-продавцы (User.isDemo) — выдуманные аккаунты с готовыми карточками:
  // почта и push по ним уходят владельцу платформы (DEMO_NOTIFY_EMAIL) с
  // пометкой, для какого именно продавца пришло, а не на несуществующий адрес.
  private async deliverExternal(
    user: Pick<User, 'id' | 'email'>,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const demoUser = await this.notificationsRepository.manager.findOne(User, {
      where: { id: user.id },
      select: { id: true, isDemo: true, firstName: true, lastName: true },
    });
    if (!demoUser?.isDemo) {
      await this.mailService.send(user.email, title, body);
      this.pushService.sendToUser(user.id, { title, body, data });
      return;
    }

    const notifyEmail = this.configService.get<string>('DEMO_NOTIFY_EMAIL');
    if (!notifyEmail) return;
    const name = [demoUser.firstName, demoUser.lastName]
      .filter(Boolean)
      .join(' ');
    const label = `[Демо: ${name}] ${title}`;
    await this.mailService.send(notifyEmail, label, body);
    const owner = await this.notificationsRepository.manager.findOne(User, {
      where: { email: notifyEmail },
      select: { id: true },
    });
    if (owner) {
      this.pushService.sendToUser(owner.id, { title: label, body, data });
    }
  }

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
    await this.deliverExternal(user, title, body, data);
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
