import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Key } from './entities/key.entity';

@Injectable()
export class KeysService {
  constructor(
    @InjectRepository(Key)
    private keysRepository: Repository<Key>,
  ) {}

  async uploadKey(userId: number, publicKey: string): Promise<Key> {
    const existing = await this.keysRepository.findOne({ where: { userId } });
    if (existing) {
      existing.publicKey = publicKey;
      return this.keysRepository.save(existing);
    }
    const key = this.keysRepository.create({ userId, publicKey });
    return this.keysRepository.save(key);
  }

  async getPublicKey(userId: number): Promise<string> {
    const key = await this.keysRepository.findOne({ where: { userId } });
    if (!key) throw new NotFoundException('Public key not found for user');
    return key.publicKey;
  }

  async hasKey(userId: number): Promise<boolean> {
    const count = await this.keysRepository.count({ where: { userId } });
    return count > 0;
  }
}
