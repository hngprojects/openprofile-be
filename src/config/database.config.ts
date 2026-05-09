import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env } from './env';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: env.DATABASE_HOST as string,
    port: env.DATABASE_PORT as number,
    username: env.DATABASE_USER as string,
    password: env.DATABASE_PASSWORD as string,
    database: env.DATABASE_NAME as string,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: env.DATABASE_SYNC as boolean,
    logging: env.DATABASE_LOGGING as boolean,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
  }),
);
