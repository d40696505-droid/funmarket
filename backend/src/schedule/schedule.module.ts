import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthModule } from '../auth/guards/jwt-auth.module';
import { Booking } from '../bookings/booking.entity';
import { Service } from '../services/service.entity';
import { ScheduleException } from './schedule-exception.entity';
import { ScheduleController } from './schedule.controller';
import { Schedule } from './schedule.entity';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, ScheduleException, Service, Booking]),
    JwtAuthModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
