import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetPasswordTable1778256179774 implements MigrationInterface {
  name = 'ResetPasswordTable1778256179774';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old email index before modifications
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_email"`);

    // Create the reset_password table (IF NOT EXISTS makes it idempotent)
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "reset_password" ("id" uuid NOT NULL, "userId" character varying NOT NULL, "tokenHash" character varying(64) NOT NULL, "used" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_82bffbeb85c5b426956d004a8f5" PRIMARY KEY ("id"))`,
    );

    // Remove password reset columns from users (no longer needed in users table)
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_expires"`,
    );

    // Recreate the email index
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the email index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );

    // Drop reset_password table
    await queryRunner.query(`DROP TABLE IF EXISTS "reset_password"`);

    // Restore password reset columns to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_token_hash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires" TIMESTAMP WITH TIME ZONE`,
    );

    // Restore the original email index
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`,
    );
  }
}
