import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateResetPasswordTokenFields1778400000001
  implements MigrationInterface
{
  name = 'UpdateResetPasswordTokenFields1778400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reset_password" ALTER COLUMN "tokenHash" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password" ADD COLUMN IF NOT EXISTS "tokenSelector" character varying(64) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_reset_password_tokenSelector" ON "reset_password" ("tokenSelector")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reset_password_tokenSelector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password" DROP COLUMN IF EXISTS "tokenSelector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password" ALTER COLUMN "tokenHash" TYPE character varying(64)`,
    );
  }
}
