import { registerAs } from '@nestjs/config';
import { env } from './env';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: env.JWT_ACCESS_SECRET as string,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN as string,
  refreshSecret: env.JWT_REFRESH_SECRET as string,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
}));
