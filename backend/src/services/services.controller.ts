import {
  Body,
  Controller,
  Delete,
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
import { AddServiceImageDto } from './dto/add-service-image.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { RejectServiceDto } from './dto/reject-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('api/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  search(@Query() query: SearchServicesDto) {
    return this.servicesService.search(query);
  }

  @Get('map')
  findMapMarkers(@Query() query: SearchServicesDto) {
    return this.servicesService.findMapMarkers(query);
  }

  @Get('carousels')
  findHomeCarousels() {
    return this.servicesService.findHomeCarousels();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.servicesService.findMine(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my/:id')
  findMineById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servicesService.findMineById(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  submit(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servicesService.submitForModeration(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servicesService.deactivate(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/activate')
  activate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servicesService.activate(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.servicesService.delete(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/images')
  addImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddServiceImageDto,
  ) {
    return this.servicesService.addImage(id, user.sub, dto.url);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.servicesService.removeImage(id, user.sub, imageId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/moderation-queue')
  findPendingModeration() {
    return this.servicesService.findPendingModeration();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/approve')
  approve(@Param('id') id: string) {
    return this.servicesService.approve(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectServiceDto) {
    return this.servicesService.reject(id, dto.comment);
  }

  @Get(':id')
  findPublicById(@Param('id') id: string) {
    return this.servicesService.findPublicById(id);
  }
}
