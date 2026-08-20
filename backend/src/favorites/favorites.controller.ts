import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('api/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.favoritesService.findServices(user.sub);
  }

  @Get('ids')
  findMineIds(@CurrentUser() user: JwtPayload) {
    return this.favoritesService.findIds(user.sub);
  }

  @Post(':serviceId')
  add(@CurrentUser() user: JwtPayload, @Param('serviceId') serviceId: string) {
    return this.favoritesService.add(user.sub, serviceId);
  }

  @Delete(':serviceId')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('serviceId') serviceId: string,
  ) {
    return this.favoritesService.remove(user.sub, serviceId);
  }
}
