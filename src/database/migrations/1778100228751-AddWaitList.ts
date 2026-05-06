import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWaitList1778100228751 implements MigrationInterface {
  name = 'AddWaitList1778100228751'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "waitList" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
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