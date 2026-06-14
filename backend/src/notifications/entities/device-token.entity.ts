import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ length: 500 })
  token: string;

  @Column({ default: 'expo' })
  platform: string;

  @CreateDateColumn()
  createdAt: Date;
}
