import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { MessagesModule } from './messages/messages.module';
import { ChatGatewayModule } from './chat-gateway/chat-gateway.module';
import { StoriesModule } from './stories/stories.module';
import { CallModule } from './call/call.module';
import { CallGatewayModule } from './call-gateway/call-gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      validationSchema: Joi.object({
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().default('root'),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().default('chat_app'),
        JWT_SECRET: Joi.string().required().min(10),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        PORT: Joi.number().default(3000),
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { ttl: 60000, limit: 60 },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        type: 'mysql',
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production',
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        charset: 'utf8mb4',
      }),
    }),
    AuthModule,
    UsersModule,
    ChatModule,
    MessagesModule,
    ChatGatewayModule,
    StoriesModule,
    CallModule,
    CallGatewayModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
