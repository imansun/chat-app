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

export enum CallStatus {
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  ENDED = 'ended',
}

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: CallType })
  type: CallType;

  @Column({ type: 'enum', enum: CallStatus, default: CallStatus.ENDED })
  status: CallStatus;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'callerId' })
  caller: User;

  @Column()
  callerId: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'calleeId' })
  callee: User;

  @Column()
  calleeId: number;

  @Column({ nullable: true })
  roomId: number;

  @Column({ default: 0 })
  duration: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
