import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Room } from './entities/room.entity';
import { User } from '../users/entities/user.entity';
import { Message } from '../messages/entities/message.entity';

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

  async createGroupRoom(name: string, userIds: number[]) {
    const users = await this.usersRepository.findBy({ id: In(userIds) });
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
          where: { roomId: room.id },
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
      where: { roomId },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
