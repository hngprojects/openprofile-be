import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileSearchFields1779000000000 implements MigrationInterface {
  name = 'AddProfileSearchFields1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username varchar(100),
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS photo_url varchar(500),
      ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
      ON users (username)
      WHERE username IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
      ON users USING GIN (full_name gin_trgm_ops)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS users_username_trgm_idx
      ON users USING GIN (username gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS users_username_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS users_full_name_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS users_username_unique_idx`);

    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS is_published,
      DROP COLUMN IF EXISTS photo_url,
      DROP COLUMN IF EXISTS bio,
      DROP COLUMN IF EXISTS username
    `);
  }
}
