import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toProfileSummary, toPublicUser } from './public-user.mapper';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.findById(currentUser.sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(currentUser.sub, dto);
    return toPublicUser(user);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/city-review-queue')
  async getCityReviewQueue() {
    const users = await this.usersService.findCityReviewQueue();
    return users.map(toPublicUser);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/approve-city')
  async approveCity(@Param('id') id: string) {
    const user = await this.usersService.approveCity(id);
    return toPublicUser(user);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/reject-city')
  async rejectCity(@Param('id') id: string) {
    const user = await this.usersService.rejectCity(id);
    return toPublicUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() currentUser: JwtPayload) {
    await this.usersService.delete(currentUser.sub);
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileSummary(user);
  }
}
