import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Call } from './entities/call.entity';
import { CallService } from './call.service';
import { CallController } from './call.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Call])],
  providers: [CallService],
  controllers: [CallController],
  exports: [CallService],
})
export class CallModule {}
