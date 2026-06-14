import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Story } from './entities/story.entity';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private storiesRepository: Repository<Story>,
  ) {}

  async create(userId: number, url: string): Promise<Story> {
    const story = this.storiesRepository.create({ userId, url });
    return this.storiesRepository.save(story);
  }

  async getActiveStories(): Promise<Story[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.storiesRepository.find({
      where: { createdAt: LessThan(twentyFourHoursAgo) },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserStories(userId: number): Promise<Story[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.storiesRepository.find({
      where: { userId, createdAt: LessThan(twentyFourHoursAgo) },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.storiesRepository.delete({ id, userId });
  }

  async cleanupExpired(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.storiesRepository.delete({
      createdAt: LessThan(twentyFourHoursAgo),
    });
  }
}
