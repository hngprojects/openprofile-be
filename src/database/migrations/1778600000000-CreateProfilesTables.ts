import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfilesTables1778600000000 implements MigrationInterface {
  name = 'CreateProfilesTables1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
      ADD COLUMN IF NOT EXISTS "is_searchable" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "components" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profile_id" uuid NOT NULL,
        "section_type" character varying(50) NOT NULL,
        "title" character varying(255),
        "content" text,
        "metadata" jsonb,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "display_order" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_components_profile_section" UNIQUE ("profile_id", "section_type"),
        CONSTRAINT "PK_components" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "components"
      ADD CONSTRAINT "FK_components_profile_id"
      FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "components" DROP CONSTRAINT IF EXISTS "FK_components_profile_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "components"`);
    await queryRunner.query(`
      ALTER TABLE "profiles"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "is_published",
      DROP COLUMN IF EXISTS "is_verified",
      DROP COLUMN IF EXISTS "is_searchable"
    `);
  }
}
