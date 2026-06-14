import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register')
  register(
    @Body('token') token: string,
    @Body('platform') platform: string,
    @Req() req: Request,
  ) {
    return this.notificationsService.registerToken(
      (req as any).user.id,
      token,
      platform || 'expo',
    );
  }

  @Delete('unregister')
  unregister(@Body('token') token: string, @Req() req: Request) {
    return this.notificationsService.unregisterToken(
      (req as any).user.id,
      token,
    );
  }
}
