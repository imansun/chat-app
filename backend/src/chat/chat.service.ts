import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Room } from './entities/room.entity';
import { User } from '../users/entities/user.entity';
import { Message, MessageType } from '../messages/entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async createPrivateRoom(userId: number, targetUserId: number) {
    const existing = await this.roomsRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'participant')
      .where('room.isGroup = :isGroup', { isGroup: false })
      .andWhere('participant.id IN (:...ids)', {
        ids: [userId, targetUserId],
      })
      .groupBy('room.id')
      .having('COUNT(room.id) = 2')
      .getOne();

    if (existing) return existing;

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const targetUser = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user || !targetUser) {
      throw new NotFoundException('User not found');
    }

    const room = this.roomsRepository.create({ isGroup: false });
    room.participants = [user, targetUser];
    return this.roomsRepository.save(room);
  }

  async createGroupRoom(name: string, userIds: number[], creatorId: number) {
    const allIds = [...new Set([...userIds, creatorId])];
    const users = await this.usersRepository.findBy({ id: In(allIds) });
    if (users.length !== allIds.length) {
      throw new NotFoundException('One or more users not found');
    }
    const room = this.roomsRepository.create({ name, isGroup: true });
    room.participants = users;
    return this.roomsRepository.save(room);
  }

  async getUserRooms(userId: number) {
    const rooms = await this.roomsRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'participant')
      .where('participant.id = :userId', { userId })
      .leftJoinAndSelect('room.participants', 'allParticipants')
      .orderBy('room.updatedAt', 'DESC')
      .getMany();

    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await this.messagesRepository.findOne({
          where: { roomId: room.id, isDeleted: false },
          order: { createdAt: 'DESC' },
          relations: { sender: true },
        });
        return { ...room, lastMessage };
      }),
    );

    return roomsWithLastMessage;
  }

  async getRoomById(roomId: number, userId: number) {
    const room = await this.roomsRepository
      .createQueryBuilder('room')
      .where('room.id = :roomId', { roomId })
      .leftJoinAndSelect('room.participants', 'participant')
      .getOne();

    if (!room) throw new NotFoundException('Room not found');

    const isParticipant = room.participants.some((p) => p.id === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    return room;
  }

  async getRoomMessages(roomId: number, userId: number, limit = 50, offset = 0) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: { participants: true },
    });

    if (!room) throw new NotFoundException('Room not found');

    const isParticipant = room.participants.some((p) => p.id === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    return this.messagesRepository.find({
      where: { roomId, isDeleted: false },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async editMessage(messageId: number, userId: number, content: string) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Not your message');

    const now = new Date().getTime();
    const msgTime = new Date(message.createdAt).getTime();
    if (now - msgTime > 5 * 60 * 1000) {
      throw new BadRequestException('Can only edit messages within 5 minutes');
    }

    message.content = content;
    message.isEdited = true;
    return this.messagesRepository.save(message);
  }

  async deleteMessage(messageId: number, userId: number) {
    const message = await this.messagesRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Not your message');

    message.isDeleted = true;
    message.content = 'This message was deleted';
    return this.messagesRepository.save(message);
  }

  async updateRoomName(roomId: number, userId: number, name: string) {
    const room = await this.getRoomById(roomId, userId);
    if (!room.isGroup) throw new BadRequestException('Not a group room');
    room.name = name;
    return this.roomsRepository.save(room);
  }

  async addRoomMembers(roomId: number, userId: number, newMemberIds: number[]) {
    const room = await this.getRoomById(roomId, userId);
    if (!room.isGroup) throw new BadRequestException('Not a group room');

    const existingIds = room.participants.map((p) => p.id);
    const toAdd = newMemberIds.filter((id) => !existingIds.includes(id));
    if (toAdd.length === 0) return room;

    const newUsers = await this.usersRepository.findBy({ id: In(toAdd) });
    room.participants = [...room.participants, ...newUsers];
    return this.roomsRepository.save(room);
  }

  async removeRoomMember(roomId: number, userId: number, targetUserId: number) {
    const room = await this.getRoomById(roomId, userId);
    if (!room.isGroup) throw new BadRequestException('Not a group room');

    room.participants = room.participants.filter((p) => p.id !== targetUserId);
    return this.roomsRepository.save(room);
  }

  async createImageMessage(
    content: string,
    senderId: number,
    roomId: number,
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      content,
      senderId,
      roomId,
      type: MessageType.IMAGE,
    });
    return this.messagesRepository.save(message);
  }
}
