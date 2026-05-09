import { Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../../config/env';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    return env.REDIS_URL ? new Redis(env.REDIS_URL) : new Redis();
  },
};
