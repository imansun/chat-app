import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Key } from './entities/key.entity';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Key])],
  providers: [KeysService],
  controllers: [KeysController],
  exports: [KeysService],
})
export class KeysModule {}
