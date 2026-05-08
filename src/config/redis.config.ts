import { registerAs } from '@nestjs/config';
import { RedisConfig } from '../common/interfaces/redis-config.interface';
import { env } from './env';

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    host: env.REDIS_HOST as string,
    port: parseInt(env.REDIS_PORT as string, 10),
    password: env.REDIS_PASSWORD as string,
    db: parseInt(env.REDIS_DB as string, 10),
  }),
);
