import { Controller, Get, UseGuards, Req, Request } from '@nestjs/common';
import { CallService } from './call.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallController {
  constructor(private callService: CallService) {}

  @Get('history')
  getHistory(@Req() req: Request) {
    return this.callService.getCallHistory((req as any).user.id);
  }

  @Get('missed')
  getMissed(@Req() req: Request) {
    return this.callService.getMissedCalls((req as any).user.id);
  }
}
