import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async createMessage(
    content: string,
    senderId: number,
    roomId: number,
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      content,
      senderId,
      roomId,
    });
    return this.messagesRepository.save(message);
  }

  async getRoomMessages(roomId: number, limit = 50, offset = 0) {
    const options: FindManyOptions<Message> = {
      where: { roomId },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    };
    return this.messagesRepository.find(options);
  }

  async markAsRead(messageId: number) {
    await this.messagesRepository.update(messageId, { isRead: true });
  }

  async markAllAsRead(roomId: number, userId: number) {
    await this.messagesRepository.update(
      { roomId, senderId: userId, isRead: false },
      { isRead: true },
    );
  }
}
