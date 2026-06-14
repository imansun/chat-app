import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokensRepository: Repository<DeviceToken>,
  ) {}

  async registerToken(
    userId: number,
    token: string,
    platform = 'expo',
  ): Promise<DeviceToken> {
    const existing = await this.deviceTokensRepository.findOne({
      where: { userId, token },
    });
    if (existing) return existing;
    const dt = this.deviceTokensRepository.create({ userId, token, platform });
    return this.deviceTokensRepository.save(dt);
  }

  async unregisterToken(userId: number, token: string): Promise<void> {
    await this.deviceTokensRepository.delete({ userId, token });
  }

  async getUserTokens(userId: number): Promise<string[]> {
    const tokens = await this.deviceTokensRepository.find({
      where: { userId },
    });
    return tokens.map((t) => t.token);
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const message = {
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high' as const,
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch {
      // silent fail - push is best-effort
    }
  }

  async notifyUser(
    userId: number,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    await Promise.allSettled(
      tokens.map((token) =>
        this.sendPushNotification(token, title, body, data),
      ),
    );
  }
}
