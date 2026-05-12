import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfilesTables1778600000000 implements MigrationInterface {
  name = 'CreateProfilesTables1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "profiles_template_id_enum" AS ENUM ('PROFESSIONAL', 'CREATOR', 'FREELANCER')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profiles" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id"       uuid NOT NULL,
        "username"      varchar(50) NULL,
        "full_name"     varchar(255) NULL,
        "bio"           text NULL,
        "avatar_url"    varchar(500) NULL,
        "template_id"   "profiles_template_id_enum" NOT NULL DEFAULT 'PROFESSIONAL',
        "theme_settings" jsonb NULL,
        "is_searchable" boolean NOT NULL DEFAULT true,
        "is_verified"   boolean NOT NULL DEFAULT false,
        "is_published"  boolean NOT NULL DEFAULT false,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz NULL,
        CONSTRAINT "PK_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_profiles_username" UNIQUE ("username"),
        CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_profiles_username" ON "profiles" ("username") WHERE username IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "components" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "profile_id"    uuid NOT NULL,
        "section_type"  varchar(50) NOT NULL,
        "title"         varchar(255) NULL,
        "content"       text NULL,
        "metadata"      jsonb NULL,
        "is_enabled"    boolean NOT NULL DEFAULT true,
        "display_order" int NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_components" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_components_profile_section" UNIQUE ("profile_id", "section_type"),
        CONSTRAINT "FK_components_profile"
          FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "components"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_profiles_username"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "profiles_template_id_enum"`);
  }
}
