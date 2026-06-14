import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
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
  createGroup(@Body() body: { name: string; userIds: number[] }, @Req() req: Request) {
    return this.chatService.createGroupRoom(body.name, body.userIds, (req as any).user.id);
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

  @Patch('room/:id')
  updateRoomName(
    @Param('id') id: string,
    @Body('name') name: string,
    @Req() req: Request,
  ) {
    return this.chatService.updateRoomName(+id, (req as any).user.id, name);
  }

  @Post('room/:id/members')
  addMembers(
    @Param('id') id: string,
    @Body('userIds') userIds: number[],
    @Req() req: Request,
  ) {
    return this.chatService.addRoomMembers(+id, (req as any).user.id, userIds);
  }

  @Delete('room/:id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.chatService.removeRoomMember(+id, (req as any).user.id, +userId);
  }

  @Patch('messages/:id')
  editMessage(
    @Param('id') id: string,
    @Body('content') content: string,
    @Req() req: Request,
  ) {
    return this.chatService.editMessage(+id, (req as any).user.id, content);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @Req() req: Request) {
    return this.chatService.deleteMessage(+id, (req as any).user.id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads', 'messages'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('roomId') roomId: string,
    @Req() req: Request,
  ) {
    const url = `/uploads/messages/${file.filename}`;
    const message = await this.chatService.createImageMessage(
      url,
      (req as any).user.id,
      +roomId,
    );
    const populated = await this.chatService.getRoomMessages(message.roomId, (req as any).user.id, 1, 0);
    return populated[0];
  }
}
