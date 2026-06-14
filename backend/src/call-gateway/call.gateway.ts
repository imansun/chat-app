import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { CallService } from '../call/call.service';
import { CallStatus, CallType } from '../call/entities/call.entity';
import { Logger } from '@nestjs/common';

@WSGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/call',
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallGateway.name);
  private onlineUsers = new Map<number, string[]>();

  constructor(
    private wsJwtGuard: WsJwtGuard,
    private callService: CallService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsJwtGuard.validate(client);
      const existing = this.onlineUsers.get(user.id) || [];
      this.onlineUsers.set(user.id, [...existing, client.id]);
      client.data.user = user;
      client.join(`user:${user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      const sockets = this.onlineUsers.get(user.id) || [];
      const filtered = sockets.filter((s) => s !== client.id);
      if (filtered.length === 0) {
        this.onlineUsers.delete(user.id);
      } else {
        this.onlineUsers.set(user.id, filtered);
      }
    }
  }

  @SubscribeMessage('call:start')
  async handleStartCall(
    client: Socket,
    payload: { targetUserId: number; type: 'audio' | 'video' },
  ) {
    const user = client.data.user;
    if (!user || !payload?.targetUserId || !payload?.type) return;
    if (!['audio', 'video'].includes(payload.type)) return;

    if (this.callService.hasActiveCall(user.id) || this.callService.hasActiveCall(payload.targetUserId)) {
      client.emit('call:busy', { targetUserId: payload.targetUserId });
      return;
    }

    const call = await this.callService.createCall(
      user.id,
      payload.targetUserId,
      payload.type as CallType,
    );

    this.callService.setActiveCall(call.id, user.id, payload.targetUserId, payload.type as CallType);

    this.server.to(`user:${payload.targetUserId}`).emit('call:incoming', {
      callId: call.id,
      caller: { id: user.id, username: user.username, avatar: user.avatar },
      type: payload.type,
    });

    client.emit('call:initiated', { callId: call.id });
  }

  @SubscribeMessage('call:accept')
  async handleAcceptCall(client: Socket, payload: { callId: number }) {
    const user = client.data.user;
    if (!user || !payload?.callId) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call || call.calleeId !== user.id) return;

    client.emit('call:accepted', { callId: payload.callId });
    this.server.to(`user:${call.callerId}`).emit('call:accepted', {
      callId: payload.callId,
      userId: user.id,
    });
  }

  @SubscribeMessage('call:reject')
  async handleRejectCall(client: Socket, payload: { callId: number }) {
    const user = client.data.user;
    if (!user || !payload?.callId) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call || call.calleeId !== user.id) return;

    await this.callService.endCall(payload.callId, CallStatus.REJECTED);
    this.server.to(`user:${call.callerId}`).emit('call:rejected', {
      callId: payload.callId,
      userId: user.id,
    });
  }

  @SubscribeMessage('call:end')
  async handleEndCall(client: Socket, payload: { callId: number }) {
    const user = client.data.user;
    if (!user || !payload?.callId) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call) return;
    if (call.callerId !== user.id && call.calleeId !== user.id) return;

    await this.callService.endCall(payload.callId, CallStatus.ENDED);

    const otherId = call.callerId === user.id ? call.calleeId : call.callerId;
    this.server.to(`user:${otherId}`).emit('call:ended', {
      callId: payload.callId,
      userId: user.id,
    });
    client.emit('call:ended', { callId: payload.callId });
  }

  @SubscribeMessage('call:offer')
  handleOffer(client: Socket, payload: { callId: number; sdp: string }) {
    const user = client.data.user;
    if (!user || !payload?.callId || !payload?.sdp) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call) return;

    client.to(`user:${call.calleeId}`).emit('call:offer', {
      callId: payload.callId,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('call:answer')
  handleAnswer(client: Socket, payload: { callId: number; sdp: string }) {
    const user = client.data.user;
    if (!user || !payload?.callId || !payload?.sdp) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call) return;

    client.to(`user:${call.callerId}`).emit('call:answer', {
      callId: payload.callId,
      sdp: payload.sdp,
    });
  }

  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(client: Socket, payload: { callId: number; candidate: string }) {
    const user = client.data.user;
    if (!user || !payload?.callId || !payload?.candidate) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call) return;

    const targetId = call.callerId === user.id ? call.calleeId : call.callerId;
    client.to(`user:${targetId}`).emit('call:ice-candidate', {
      callId: payload.callId,
      candidate: payload.candidate,
    });
  }

  @SubscribeMessage('call:missed')
  async handleMissedCall(client: Socket, payload: { callId: number }) {
    const user = client.data.user;
    if (!user || !payload?.callId) return;

    const call = this.callService.getActiveCall(payload.callId);
    if (!call || call.callerId !== user.id) return;

    await this.callService.endCall(payload.callId, CallStatus.MISSED);
  }
}
