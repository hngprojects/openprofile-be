import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfilesTables1778600000000 implements MigrationInterface {
  name = 'CreateProfilesTables1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profiles" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "username"       varchar(50) NOT NULL,
        "user_id"        uuid NOT NULL,
        "bio"            text NULL,
        "photo_url"      varchar(500) NULL,
        "cta_label"      varchar(100) NULL,
        "cta_url"        varchar(500) NULL,
        "theme_settings" jsonb NULL,
        "is_published"   boolean NOT NULL DEFAULT false,
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        "deleted_at"     timestamptz NULL,
        CONSTRAINT "PK_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_profiles_username" UNIQUE ("username"),
        CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_profiles_username" ON "profiles" ("username")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "profile_components" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "profile_id"    uuid NOT NULL,
        "type"          varchar(50) NOT NULL,
        "display_order" int NOT NULL DEFAULT 0,
        "data"          jsonb NOT NULL,
        "is_active"     boolean NOT NULL DEFAULT true,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile_components" PRIMARY KEY ("id"),
        CONSTRAINT "FK_profile_components_profile"
          FOREIGN KEY ("profile_id") REFERENCES "profiles" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "profile_components"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_profiles_username"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles"`);
  }
}
