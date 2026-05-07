import { registerAs } from '@nestjs/config';
import { RedisConfig } from '../common/interfaces/redis-config.interface';
import { env } from './env';

export const redisConfig = registerAs(
  'redis',
  (): RedisConfig => ({
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
    password: env.REDIS_PASSWORD,
    db: parseInt(env.REDIS_DB, 10),
  }),
);
