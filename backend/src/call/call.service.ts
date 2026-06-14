import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, CallStatus, CallType } from './entities/call.entity';

@Injectable()
export class CallService {
  private activeCalls = new Map<
    number,
    {
      callId: number;
      callerId: number;
      calleeId: number;
      type: CallType;
      startTime: number;
    }
  >();

  constructor(
    @InjectRepository(Call)
    private callsRepository: Repository<Call>,
  ) {}

  async createCall(
    callerId: number,
    calleeId: number,
    type: CallType,
  ): Promise<Call> {
    const call = this.callsRepository.create({ callerId, calleeId, type });
    return this.callsRepository.save(call);
  }

  setActiveCall(
    callId: number,
    callerId: number,
    calleeId: number,
    type: CallType,
  ) {
    this.activeCalls.set(callId, {
      callId,
      callerId,
      calleeId,
      type,
      startTime: Date.now(),
    });
  }

  getActiveCall(callId: number) {
    return this.activeCalls.get(callId);
  }

  hasActiveCall(userId: number): boolean {
    for (const call of this.activeCalls.values()) {
      if (call.callerId === userId || call.calleeId === userId) return true;
    }
    return false;
  }

  findCallByUserId(userId: number) {
    for (const call of this.activeCalls.values()) {
      if (call.callerId === userId || call.calleeId === userId) return call;
    }
    return null;
  }

  async endCall(callId: number, status: CallStatus): Promise<Call> {
    const call = await this.callsRepository.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    const active = this.activeCalls.get(callId);
    const duration = active
      ? Math.floor((Date.now() - active.startTime) / 1000)
      : 0;

    call.status = status;
    call.duration = duration;
    this.activeCalls.delete(callId);
    return this.callsRepository.save(call);
  }

  async getCallHistory(userId: number): Promise<Call[]> {
    return this.callsRepository.find({
      where: [{ callerId: userId }, { calleeId: userId }],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getMissedCalls(userId: number): Promise<Call[]> {
    return this.callsRepository.find({
      where: { calleeId: userId, status: CallStatus.MISSED },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
