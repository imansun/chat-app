import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UsersService } from '../../users/users.service';

@Injectable()
export class WsJwtGuard {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async validate(client: Socket): Promise<{ id: number; username: string; avatar: string | null; email: string }> {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }
      return { id: user.id, username: user.username, avatar: user.avatar, email: user.email };
    } catch {
      throw new Error('Invalid token');
    }
  }
}
