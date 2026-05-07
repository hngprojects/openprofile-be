import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';

import { RedisConfig } from '../../common/interfaces/redis-config.interface';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [
    UsersModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const cfg = configService.get<RedisConfig>('redis');
        return {
          connection: {
            host: cfg?.host,
            port: cfg?.port,
            password: cfg?.password,
            db: cfg?.db,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'user-welcome',
    }),
    EmailModule,
  ],
  // providers: [EmailService], // Removed, now provided by EmailModule
})
export class QueueModule {}
