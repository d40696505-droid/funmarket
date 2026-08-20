import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/auth.service';
import { UsersService } from '../users.service';

// Предполагает, что перед ним в цепочке guard'ов уже отработал
// JwtAuthGuard и заполнил request.user: @UseGuards(JwtAuthGuard, AdminGuard).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();

    const user = await this.usersService.findById(request.user.sub);
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
