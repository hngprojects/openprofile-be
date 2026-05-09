import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpToUsers1778324143106 implements MigrationInterface {
  name = 'AddOtpToUsers1778324143106';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otp_hash" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "otp_expires_at" timestamp`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_verified"`);
  }
}
