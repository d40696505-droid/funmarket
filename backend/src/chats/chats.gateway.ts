import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/auth.service';
import { ChatsService } from './chats.service';
import type { MessageCreatedEvent } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { PresenceService } from './presence.service';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function chatRoom(chatId: string): string {
  return `chat:${chatId}`;
}

// FR-6.2: WebSocket-доставка сообщений в реальном времени, путь /ws/chat.
@WebSocketGateway({ path: '/ws/chat', cors: { origin: true } })
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly chatsService: ChatsService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (!token) {
      socket.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      (socket as AuthedSocket).data.userId = payload.sub;
      await socket.join(userRoom(payload.sub));
      this.presenceService.markOnline(payload.sub);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket): void {
    const userId = (socket as AuthedSocket).data?.userId;
    if (userId) {
      this.presenceService.markOffline(userId);
    }
  }

  @SubscribeMessage('chat:join')
  handleJoinChat(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { chatId: string },
  ): void {
    void socket.join(chatRoom(data.chatId));
  }

  @SubscribeMessage('chat:leave')
  handleLeaveChat(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { chatId: string },
  ): void {
    void socket.leave(chatRoom(data.chatId));
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: SendMessageDto & { chatId: string },
  ): Promise<void> {
    try {
      await this.chatsService.sendMessage(
        data.chatId,
        socket.data.userId,
        data.text,
        data.imageUrls,
      );
      // Доставка всем подписчикам чата и уведомление получателя
      // происходят через обработчик события 'message.created' ниже.
    } catch (err) {
      socket.emit('message:error', {
        message:
          err instanceof Error ? err.message : 'Не удалось отправить сообщение',
      });
    }
  }

  @OnEvent('message.created')
  handleMessageCreated(event: MessageCreatedEvent): void {
    this.server.to(chatRoom(event.chatId)).emit('message:new', event.message);
    this.server
      .to(userRoom(event.recipientId))
      .emit('chat:notify', { chatId: event.chatId, message: event.message });
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }
    const queryToken = socket.handshake.query?.token;
    return typeof queryToken === 'string' ? queryToken : null;
  }
}
