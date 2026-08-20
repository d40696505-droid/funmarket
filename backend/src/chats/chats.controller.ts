import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../users/guards/admin.guard';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ReportMessageDto } from './dto/report-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('api/chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateChatDto) {
    return this.chatsService.findOrCreateChat(user.sub, dto.participantId);
  }

  @Get()
  findMine(@CurrentUser() user: JwtPayload) {
    return this.chatsService.findMine(user.sub);
  }

  @UseGuards(AdminGuard)
  @Get('admin/reports')
  findAllReports() {
    return this.chatsService.findAllReports();
  }

  @Get(':id/messages')
  findMessages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatsService.findMessages(id, user.sub);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatsService.sendMessage(id, user.sub, dto.text, dto.imageUrls);
  }

  @Post('messages/:id/report')
  reportMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.chatsService.reportMessage(id, user.sub, dto.reason);
  }
}
