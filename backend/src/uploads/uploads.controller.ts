import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from '../services/services.service';
import { CreateAvatarUploadDto } from './dto/create-avatar-upload.dto';
import { CreateReviewPhotoUploadDto } from './dto/create-review-photo-upload.dto';
import { CreateServiceImageUploadDto } from './dto/create-service-image-upload.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('api/uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly servicesService: ServicesService,
  ) {}

  @Post('avatar')
  createAvatarUploadUrl(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateAvatarUploadDto,
  ) {
    return this.uploadsService.createAvatarUploadUrl(
      currentUser.sub,
      dto.contentType,
    );
  }

  @Post('service-image')
  async createServiceImageUploadUrl(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateServiceImageUploadDto,
  ) {
    // Проверка владения услугой — бросит ForbiddenException/NotFoundException,
    // если сервис не принадлежит текущему продавцу.
    await this.servicesService.findMineById(dto.serviceId, currentUser.sub);
    return this.uploadsService.createServiceImageUploadUrl(
      dto.serviceId,
      dto.contentType,
    );
  }

  @Post('review-photo')
  createReviewPhotoUploadUrl(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateReviewPhotoUploadDto,
  ) {
    return this.uploadsService.createReviewPhotoUploadUrl(
      currentUser.sub,
      dto.contentType,
    );
  }
}
