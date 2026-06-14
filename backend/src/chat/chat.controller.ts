import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Request,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('private')
  createPrivate(@Body('targetUserId') targetUserId: number, @Req() req: Request) {
    return this.chatService.createPrivateRoom((req as any).user.id, targetUserId);
  }

  @Post('group')
  createGroup(@Body() body: { name: string; userIds: number[] }) {
    return this.chatService.createGroupRoom(body.name, body.userIds);
  }

  @Get('rooms')
  getRooms(@Req() req: Request) {
    return this.chatService.getUserRooms((req as any).user.id);
  }

  @Get('room/:id')
  getRoom(@Param('id') id: string, @Req() req: Request) {
    return this.chatService.getRoomById(+id, (req as any).user.id);
  }

  @Get('room/:id/messages')
  getRoomMessages(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.chatService.getRoomMessages(
      +id,
      (req as any).user.id,
      limit ? +limit : 50,
      offset ? +offset : 0,
    );
  }
}
