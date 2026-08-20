import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { GetSlotsDto } from './dto/get-slots.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller('api/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.scheduleService.findMySchedule(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  replace(@CurrentUser() user: JwtPayload, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.replaceSchedule(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('exceptions')
  findMyExceptions(@CurrentUser() user: JwtPayload) {
    return this.scheduleService.findMyExceptions(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exceptions')
  addException(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.scheduleService.addException(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('exceptions/:id')
  removeException(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.scheduleService.removeException(user.sub, id);
  }

  @Get(':sellerId/slots')
  getAvailableSlots(
    @Param('sellerId') sellerId: string,
    @Query() query: GetSlotsDto,
  ) {
    return this.scheduleService.getAvailableSlots(
      sellerId,
      query.serviceId,
      query.date,
    );
  }
}
