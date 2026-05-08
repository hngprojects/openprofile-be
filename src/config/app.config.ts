import { registerAs } from '@nestjs/config';
import { env } from './env';

export const appConfig = registerAs('app', () => ({
  nodeEnv: env.NODE_ENV as 'development' | 'test' | 'production',
  port: env.PORT as number,
  corsOrigin: env.CORS_ORIGIN as string,
  swaggerEnabled: env.SWAGGER_ENABLED as boolean,
}));
