import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';
import { PushService } from './push.service';

@ApiTags('push')
@Controller('api/push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // Публичный — нужен браузеру до входа в аккаунт, чтобы создать подписку
  // тем же ключом, что использует сервер (VAPID public key — не секрет).
  @Get('vapid-public-key')
  getPublicKey() {
    return { publicKey: this.pushService.publicKey };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubscribePushDto,
  ) {
    await this.pushService.subscribe(user.sub, dto);
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UnsubscribePushDto,
  ) {
    await this.pushService.unsubscribe(user.sub, dto.endpoint);
    return { ok: true };
  }
}
