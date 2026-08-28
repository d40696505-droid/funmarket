import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

// Отдельный контроллер (не /api/users/support) — иначе конфликтовал бы с
// UsersController.getPublicProfile(@Param('id')), который перехватил бы
// путь "support" как :id, встань он раньше в порядке роутов.
@ApiTags('support')
@Controller('api/support')
export class SupportController {
  constructor(private readonly usersService: UsersService) {}

  // Публичный — доступен и незалогиненным (просто не даёт начать чат без
  // входа, это уже проверяется на стороне чата).
  @Get('contact')
  async getContact() {
    const user = await this.usersService.findSupportContact();
    if (!user) {
      throw new NotFoundException('Поддержка временно недоступна');
    }
    return {
      id: user.id,
      name:
        user.brandName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        'Поддержка',
    };
  }
}
