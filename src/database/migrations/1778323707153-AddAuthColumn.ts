import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthColumn1778323707153 implements MigrationInterface {
  name = 'AddAuthColumn1778323707153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "waitList" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "emailSent" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c964d1d61359c1a9f8aa31eb0c2" UNIQUE ("email"), CONSTRAINT "PK_f96a6aa67f33d3613d1a7f904ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" character varying(50) NOT NULL DEFAULT 'email'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_hash" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "otp_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    
    // Check if role column exists before modifying it
    const table = await queryRunner.getTable("users");
    const roleColumn = table?.findColumnByName("role");
    
    if (roleColumn) {
      await queryRunner.query(
        `ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if role column exists before modifying it
    const table = await queryRunner.getTable("users");
    const roleColumn = table?.findColumnByName("role");
    
    if (roleColumn) {
      await queryRunner.query(
        `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'`,
      );
      await queryRunner.query(
        `ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL`,
      );
    }
    
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_hash"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "onboarding_complete"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_verified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "auth_provider"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "waitList"`);
  }
}
