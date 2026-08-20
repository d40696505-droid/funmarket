import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

// Отдельный модуль, чтобы AuthModule и UsersModule могли использовать
// JwtAuthGuard, не создавая циклическую зависимость друг на друга
// (AuthModule и так импортирует UsersModule для UsersService).
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class JwtAuthModule {}
