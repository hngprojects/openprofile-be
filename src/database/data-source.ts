import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from '../config/env';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.DATABASE_HOST as string,
  port: env.DATABASE_PORT as number,
  username: env.DATABASE_USER as string,
  password: env.DATABASE_PASSWORD as string,
  database: env.DATABASE_NAME as string,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: env.DATABASE_LOGGING as boolean,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
