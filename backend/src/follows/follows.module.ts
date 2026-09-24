import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { Follow } from './follow.entity';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, User]),
    JwtAuthModule,
    NotificationsModule,
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
