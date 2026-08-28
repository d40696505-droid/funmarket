import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { AdminGuard } from './guards/admin.guard';
import { SupportController } from './support.controller';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), JwtAuthModule],
  controllers: [UsersController, SupportController],
  providers: [UsersService, AdminGuard],
  exports: [UsersService, AdminGuard, JwtAuthModule],
})
export class UsersModule {}
