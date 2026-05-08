import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaitList1778100228751 implements MigrationInterface {
  name = 'AddWaitList1778100228751';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "waitList" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "emailSent" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_waitlist_email" UNIQUE ("email"),
        CONSTRAINT "PK_waitlist_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "waitList"`);
  }
}

export class NormalizeWaitlistEmailCase1778100228752 implements MigrationInterface {
  name = 'NormalizeWaitlistEmailCase1778100228752';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing case-sensitive unique constraint
    await queryRunner.query(`
      ALTER TABLE "waitList" DROP CONSTRAINT "UQ_waitlist_email"
    `);

    // Lowercase all existing emails
    await queryRunner.query(`
      UPDATE "waitList" SET email = lower(email)
    `);

    // Add case-insensitive unique index on lower(email)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_waitlist_email_lower" ON "waitList" (lower(email))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_waitlist_email_lower"`);
    await queryRunner.query(`
      ALTER TABLE "waitList" ADD CONSTRAINT "UQ_waitlist_email" UNIQUE (email)
    `);
  }
}
