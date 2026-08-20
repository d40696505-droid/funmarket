import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { UsersModule } from '../users/users.module';
import { Chat } from './chat.entity';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';
import { MessageReport } from './message-report.entity';
import { Message } from './message.entity';
import { PresenceService } from './presence.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message, MessageReport]),
    JwtAuthModule,
    UsersModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, PresenceService, ChatsGateway],
  exports: [ChatsService, PresenceService],
})
export class ChatsModule {}
