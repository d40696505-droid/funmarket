import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { ProposeRescheduleDto } from './dto/propose-reschedule.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('api/bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.sub, dto);
  }

  @Get()
  findMine(@CurrentUser() user: JwtPayload, @Query() query: ListBookingsDto) {
    return this.bookingsService.findMine(user.sub, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bookingsService.findByIdForParticipant(id, user.sub);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user.sub, dto.reason);
  }

  @Patch(':id/confirm')
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
  ) {
    return this.bookingsService.confirm(id, user.sub, dto);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookingsService.reject(id, user.sub, dto.reason);
  }

  @Patch(':id/propose-reschedule')
  proposeReschedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ProposeRescheduleDto,
  ) {
    return this.bookingsService.proposeReschedule(id, user.sub, dto);
  }

  @Patch(':id/accept-reschedule')
  acceptReschedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bookingsService.acceptReschedule(id, user.sub);
  }

  @Patch(':id/reject-reschedule')
  rejectReschedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.bookingsService.rejectReschedule(id, user.sub);
  }

  // Только для dev/test — детерминированный триггер крона автоотмены неоплаченных
  // броней в e2e-скриптах, без ожидания реального тика (аналог payments/admin/debug).
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/debug/trigger-auto-cancel-cron')
  async triggerAutoCancelCron() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Недоступно в production');
    }
    await this.bookingsService.autoCancelUnpaidBookings();
    return { ok: true };
  }
}
