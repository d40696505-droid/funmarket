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
import { DisputeBookingDto } from './dto/dispute-booking.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { VerifySellerDto } from './dto/verify-seller.dto';
import { PaymentsService } from './payments.service';
import { MockYookassaProvider } from './providers/mock-yookassa.provider';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('api/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mockProvider: MockYookassaProvider,
  ) {}

  @Post('bookings/:id/initiate')
  initiate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.initiate(id, user.sub);
  }

  @Get('bookings/:id/status')
  getStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.getStatusForBooking(id, user.sub);
  }

  @Post('bookings/:id/refund-cancel')
  refundCancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.refundBooking(id, user.sub);
  }

  @Post('bookings/:id/dispute')
  dispute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DisputeBookingDto,
  ) {
    return this.paymentsService.dispute(id, user.sub, dto.reason);
  }

  @Get('transactions/:id')
  getTransaction(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.getTransactionForUser(id, user.sub);
  }

  // Мок-only: страница /checkout зовёт эти два эндпоинта вместо реального
  // ввода данных карты на стороне провайдера.
  @Post('checkout/:id/simulate')
  simulate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.simulateCheckoutSuccess(
      id,
      user.sub,
      (rawBody) => this.mockProvider.sign(rawBody),
    );
  }

  @Post('checkout/:id/cancel')
  cancelCheckout(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.paymentsService.cancelCheckout(id, user.sub);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getSellerBalance(user.sub);
  }

  @Get('payouts')
  getPayouts(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.getPayoutHistory(user.sub);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/sellers')
  listSellers(@Query('verified') verified?: string) {
    const filter = verified === undefined ? undefined : verified === 'true';
    return this.paymentsService.listSellers(filter);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/sellers/:userId/verify')
  verifySeller(@Param('userId') userId: string, @Body() dto: VerifySellerDto) {
    return this.paymentsService.toggleSellerVerification(userId, dto.verified);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/bookings/:id/resolve-dispute')
  resolveDispute(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.paymentsService.resolveDispute(id, dto.resolution);
  }

  // Только для dev/test — детерминированный триггер крона в e2e-скриптах,
  // без ожидания реального тика.
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/debug/trigger-release-cron')
  async triggerReleaseCron() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Недоступно в production');
    }
    await this.paymentsService.autoReleaseEscrow();
    return { ok: true };
  }
}
