import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { censorProfanity } from './content-filter';
import { Chat } from './chat.entity';
import { MessageReport } from './message-report.entity';
import { Message } from './message.entity';
import { PresenceService } from './presence.service';

export interface ChatSummary {
  id: string;
  bookingId: string | null;
  otherParticipant: Pick<
    User,
    'id' | 'firstName' | 'lastName' | 'brandName' | 'avatarUrl'
  >;
  lastMessageAt: Date | null;
  lastMessageText: string | null;
  unreadCount: number;
  isOnline: boolean;
}

export interface MessageCreatedEvent {
  chatId: string;
  message: Message;
  recipientId: string;
}

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatsRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(MessageReport)
    private readonly messageReportsRepository: Repository<MessageReport>,
    private readonly presenceService: PresenceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findOrCreateChat(
    userId: string,
    otherUserId: string,
    bookingId?: string,
  ): Promise<Chat> {
    if (userId === otherUserId) {
      throw new BadRequestException('Нельзя создать чат с самим собой');
    }

    const existing = await this.chatsRepository
      .createQueryBuilder('chat')
      .where(
        '(chat.participant1Id = :userId AND chat.participant2Id = :otherUserId) OR ' +
          '(chat.participant1Id = :otherUserId AND chat.participant2Id = :userId)',
        { userId, otherUserId },
      )
      .getOne();

    if (existing) {
      if (bookingId && existing.bookingId !== bookingId) {
        existing.bookingId = bookingId;
        await this.chatsRepository.save(existing);
      }
      return existing;
    }

    const chat = this.chatsRepository.create({
      participant1Id: userId,
      participant2Id: otherUserId,
      bookingId: bookingId ?? null,
    });
    return this.chatsRepository.save(chat);
  }

  async findMine(userId: string): Promise<ChatSummary[]> {
    const chats = await this.chatsRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.participant1', 'participant1')
      .leftJoinAndSelect('chat.participant2', 'participant2')
      .where('chat.participant1Id = :userId OR chat.participant2Id = :userId', {
        userId,
      })
      .orderBy('chat.lastMessageAt', 'DESC', 'NULLS LAST')
      .getMany();

    const summaries: ChatSummary[] = [];
    for (const chat of chats) {
      const other =
        chat.participant1Id === userId ? chat.participant2 : chat.participant1;
      const lastMessage = await this.messagesRepository.findOne({
        where: { chatId: chat.id },
        order: { createdAt: 'DESC' },
      });
      const unreadCount = await this.messagesRepository.count({
        where: { chatId: chat.id, isRead: false },
      });

      summaries.push({
        id: chat.id,
        bookingId: chat.bookingId,
        otherParticipant: {
          id: other.id,
          firstName: other.firstName,
          lastName: other.lastName,
          brandName: other.brandName,
          avatarUrl: other.avatarUrl,
        },
        lastMessageAt: chat.lastMessageAt,
        lastMessageText: lastMessage?.text ?? null,
        unreadCount,
        isOnline: this.presenceService.isOnline(other.id),
      });
    }
    return summaries;
  }

  async findMessages(chatId: string, userId: string): Promise<Message[]> {
    const chat = await this.getChatForParticipant(chatId, userId);
    const messages = await this.messagesRepository.find({
      where: { chatId: chat.id },
      order: { createdAt: 'ASC' },
    });

    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('chatId = :chatId AND senderId != :userId AND isRead = false', {
        chatId: chat.id,
        userId,
      })
      .execute();

    return messages;
  }

  async sendMessage(
    chatId: string,
    senderId: string,
    text: string,
    imageUrls?: string[],
  ): Promise<Message> {
    const chat = await this.getChatForParticipant(chatId, senderId);

    const message = this.messagesRepository.create({
      chatId: chat.id,
      senderId,
      text: censorProfanity(text),
      imageUrls: imageUrls ?? [],
    });
    const saved = await this.messagesRepository.save(message);

    chat.lastMessageAt = saved.createdAt;
    await this.chatsRepository.save(chat);

    const recipientId =
      chat.participant1Id === senderId
        ? chat.participant2Id
        : chat.participant1Id;
    this.eventEmitter.emit('message.created', {
      chatId: chat.id,
      message: saved,
      recipientId,
    } satisfies MessageCreatedEvent);

    return saved;
  }

  async addSystemMessage(chatId: string, text: string): Promise<Message> {
    const message = this.messagesRepository.create({
      chatId,
      senderId: null,
      isSystem: true,
      text,
      imageUrls: [],
    });
    const saved = await this.messagesRepository.save(message);

    await this.chatsRepository.update(chatId, {
      lastMessageAt: saved.createdAt,
    });

    const chat = await this.chatsRepository.findOne({ where: { id: chatId } });
    if (chat) {
      // Системное сообщение адресуем обоим — гейтвей сам решит, кто подключён.
      for (const recipientId of [chat.participant1Id, chat.participant2Id]) {
        this.eventEmitter.emit('message.created', {
          chatId,
          message: saved,
          recipientId,
        } satisfies MessageCreatedEvent);
      }
    }

    return saved;
  }

  // FR-6.4: жалоба на сообщение — доступна только участникам его чата.
  async reportMessage(
    messageId: string,
    reporterId: string,
    reason: string,
  ): Promise<MessageReport> {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    await this.getChatForParticipant(message.chatId, reporterId);

    const report = this.messageReportsRepository.create({
      messageId,
      reporterId,
      reason,
    });
    return this.messageReportsRepository.save(report);
  }

  findAllReports(): Promise<MessageReport[]> {
    return this.messageReportsRepository.find({
      relations: { message: true, reporter: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async getChatForParticipant(
    chatId: string,
    userId: string,
  ): Promise<Chat> {
    const chat = await this.chatsRepository.findOne({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }
    if (chat.participant1Id !== userId && chat.participant2Id !== userId) {
      throw new ForbiddenException('Нет доступа к этому чату');
    }
    return chat;
  }
}
