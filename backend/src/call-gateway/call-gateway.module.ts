import { Module } from '@nestjs/common';
import { CallGateway } from './call.gateway';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { CallModule } from '../call/call.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [CallModule, JwtModule],
  providers: [CallGateway, WsJwtGuard],
})
export class CallGatewayModule {}
