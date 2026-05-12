import { Module } from '@nestjs/common';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';
import { UsersModule } from '../users/users.module';
import { UsernameRateLimitGuard } from './guards/username-rate-limit.guard';
import { UsernamesController } from './usernames.controller';
import { UsernamesService } from './usernames.service';

@Module({
  imports: [UsersModule, RateLimiterModule],
  controllers: [UsernamesController],
  providers: [UsernamesService, UsernameRateLimitGuard],
})
export class UsernamesModule {}
