import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
