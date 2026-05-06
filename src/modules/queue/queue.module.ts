import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { EmailService } from '../../common/service/email.service';
import { redisConfig } from '../../config/redis.config';

@Module({
  imports: [
    UsersModule,
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
  providers: [EmailService],
})
export class QueueModule {}
