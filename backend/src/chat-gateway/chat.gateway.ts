import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { MessagesService } from '../messages/messages.service';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';

@WSGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<number, string[]>();

  constructor(
    private wsJwtGuard: WsJwtGuard,
    private messagesService: MessagesService,
    private chatService: ChatService,
    private usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.wsJwtGuard.validate(client);

      const existing = this.onlineUsers.get(user.id) || [];
      this.onlineUsers.set(user.id, [...existing, client.id]);

      await this.usersService.updateOnlineStatus(user.id, true);

      client.data.user = user;
      client.join(`user:${user.id}`);

      const rooms = await this.chatService.getUserRooms(user.id);
      rooms.forEach((room) => {
        client.join(`room:${room.id}`);
      });

      this.server.emit('user:online', { userId: user.id, isOnline: true });

      client.emit('connected', { userId: user.id });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) {
      const sockets = this.onlineUsers.get(user.id) || [];
      const filtered = sockets.filter((s) => s !== client.id);

      if (filtered.length === 0) {
        this.onlineUsers.delete(user.id);
        await this.usersService.updateOnlineStatus(user.id, false);
        this.server.emit('user:offline', { userId: user.id, isOnline: false });
      } else {
        this.onlineUsers.set(user.id, filtered);
      }
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    client: Socket,
    payload: { roomId: number; content: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    const message = await this.messagesService.createMessage(
      payload.content,
      user.id,
      payload.roomId,
    );

    const populated = await this.messagesService.getRoomMessages(
      payload.roomId,
      1,
      0,
    );

    this.server.to(`room:${payload.roomId}`).emit('message:new', populated[0]);
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    client: Socket,
    payload: { messageId: number; content: string; roomId: number },
  ) {
    const user = client.data.user;
    if (!user) return;

    try {
      const updated = await this.chatService.editMessage(
        payload.messageId,
        user.id,
        payload.content,
      );
      this.server.to(`room:${payload.roomId}`).emit('message:edited', {
        messageId: payload.messageId,
        content: updated.content,
        isEdited: true,
      });
    } catch {}
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    client: Socket,
    payload: { messageId: number; roomId: number },
  ) {
    const user = client.data.user;
    if (!user) return;

    try {
      await this.chatService.deleteMessage(payload.messageId, user.id);
      this.server.to(`room:${payload.roomId}`).emit('message:deleted', {
        messageId: payload.messageId,
      });
    } catch {}
  }

  @SubscribeMessage('image:send')
  async handleImageMessage(
    client: Socket,
    payload: { roomId: number; url: string },
  ) {
    const user = client.data.user;
    if (!user) return;

    const message = await this.chatService.createImageMessage(
      payload.url,
      user.id,
      payload.roomId,
    );

    const populated = await this.messagesService.getRoomMessages(
      payload.roomId,
      1,
      0,
    );

    this.server.to(`room:${payload.roomId}`).emit('message:new', populated[0]);
  }

  @SubscribeMessage('room:join')
  handleJoinRoom(client: Socket, roomId: number) {
    client.join(`room:${roomId}`);
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(client: Socket, roomId: number) {
    client.leave(`room:${roomId}`);
  }

  @SubscribeMessage('message:read')
  async handleRead(
    client: Socket,
    payload: { messageId: number; roomId: number },
  ) {
    await this.messagesService.markAsRead(payload.messageId);
    this.server.to(`room:${payload.roomId}`).emit('message:read', {
      messageId: payload.messageId,
      userId: client.data.user.id,
    });
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    client: Socket,
    payload: { roomId: number; username: string },
  ) {
    client
      .to(`room:${payload.roomId}`)
      .emit('typing:start', { userId: client.data.user.id, ...payload });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    client: Socket,
    payload: { roomId: number; username: string },
  ) {
    client
      .to(`room:${payload.roomId}`)
      .emit('typing:stop', { userId: client.data.user.id, ...payload });
  }
}
