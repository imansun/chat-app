import { Controller, Post, Get, Param, Body, UseGuards, Req, Request } from '@nestjs/common';
import { KeysService } from './keys.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('keys')
@UseGuards(JwtAuthGuard)
export class KeysController {
  constructor(private keysService: KeysService) {}

  @Post()
  uploadKey(@Body('publicKey') publicKey: string, @Req() req: Request) {
    return this.keysService.uploadKey((req as any).user.id, publicKey);
  }

  @Get(':userId')
  getKey(@Param('userId') userId: string) {
    return this.keysService.getPublicKey(+userId);
  }

  @Get('me/has')
  hasKey(@Req() req: Request) {
    return this.keysService.hasKey((req as any).user.id);
  }
}
