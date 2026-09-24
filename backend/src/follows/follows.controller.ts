import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@Controller('api/follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.followsService.findSellers(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('ids')
  findMineIds(@CurrentUser() user: JwtPayload) {
    return this.followsService.findIds(user.sub);
  }

  // Публичный: число подписчиков показывается в профиле продавца всем.
  @Get('count/:sellerId')
  async count(@Param('sellerId', ParseUUIDPipe) sellerId: string) {
    return { count: await this.followsService.countFollowers(sellerId) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':sellerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  follow(
    @CurrentUser() user: JwtPayload,
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ) {
    return this.followsService.follow(user.sub, sellerId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':sellerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollow(
    @CurrentUser() user: JwtPayload,
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ) {
    return this.followsService.unfollow(user.sub, sellerId);
  }
}
