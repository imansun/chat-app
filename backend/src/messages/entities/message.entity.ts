import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from '../../chat/entities/room.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: number;

  @ManyToOne(() => Room, (room) => room.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  roomId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
