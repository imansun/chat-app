import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { MessagesModule } from '../messages/messages.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MessagesModule,
    ChatModule,
    UsersModule,
    NotificationsModule,
    JwtModule,
  ],
  providers: [ChatGateway, WsJwtGuard],
})
export class ChatGatewayModule {}
