import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisConfig } from '../../config/redis.config';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../common/service/email.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        const cfg = redisConfig();
        return {
          connection: {
            host: cfg.host,
            port: cfg.port,
            password: cfg.password,
            db: cfg.db,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'user-welcome',
    }),
  ],
  providers: [UsersService, EmailService],
})
export class QueueModule {}
