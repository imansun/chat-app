import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('user.username LIKE :query', { query: `%${query}%` })
      .orWhere('user.email LIKE :query', { query: `%${query}%` })
      .limit(20)
      .getMany();
  }

  async updateOnlineStatus(id: number, isOnline: boolean): Promise<void> {
    await this.usersRepository.update(id, { isOnline });
  }

  async updateProfile(
    id: number,
    data: { username?: string; email?: string; avatar?: string },
  ): Promise<User> {
    if (data.username) {
      const existing = await this.usersRepository.findOne({
        where: { username: data.username },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Username already taken');
      }
    }

    if (data.email) {
      const existing = await this.usersRepository.findOne({
        where: { email: data.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already taken');
      }
    }

    await this.usersRepository.update(id, data);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
