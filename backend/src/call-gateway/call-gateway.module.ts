import { Module } from '@nestjs/common';
import { CallGateway } from './call.gateway';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { CallModule } from '../call/call.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [CallModule, NotificationsModule, UsersModule, JwtModule],
  providers: [CallGateway, WsJwtGuard],
})
export class CallGatewayModule {}
