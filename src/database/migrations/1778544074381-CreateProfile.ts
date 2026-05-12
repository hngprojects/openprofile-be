import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProfile1778544074381 implements MigrationInterface {
    name = 'CreateProfile1778544074381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "waitList" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "emailSent" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c964d1d61359c1a9f8aa31eb0c2" UNIQUE ("email"), CONSTRAINT "PK_f96a6aa67f33d3613d1a7f904ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
              CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'user');
            END IF;
          END $$;
        `);
        
        // Add missing columns to users table if they don't exist
        await queryRunner.query(`
          ALTER TABLE "users" 
          ADD COLUMN IF NOT EXISTS "full_name" character varying(255),
          ADD COLUMN IF NOT EXISTS "role" "public"."users_role_enum",
          ADD COLUMN IF NOT EXISTS "refresh_token_hash" character varying(500),
          ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
        `);
        
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "username" character varying NOT NULL, "full_name" character varying NOT NULL, "bio" text, "photo_url" character varying, "template_type" character varying, "theme_settings" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d1ea35db5be7c08520d70dc03f8" UNIQUE ("username"), CONSTRAINT "REL_9e432b7df0d182f8d292902d1a" UNIQUE ("user_id"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "reset_password" ("id" uuid NOT NULL, "userId" character varying NOT NULL, "tokenSelector" character varying(64) NOT NULL, "tokenHash" text NOT NULL, "used" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_82bffbeb85c5b426956d004a8f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'FK_9e432b7df0d182f8d292902d1a2'
                AND table_name = 'profiles'
            ) THEN
              ALTER TABLE "profiles" ADD CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            END IF;
          END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "FK_9e432b7df0d182f8d292902d1a2"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "reset_password"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "profiles"`);
        await queryRunner.query(`
          ALTER TABLE "users" 
          DROP COLUMN IF EXISTS "deleted_at",
          DROP COLUMN IF EXISTS "refresh_token_hash",
          DROP COLUMN IF EXISTS "role",
          DROP COLUMN IF EXISTS "full_name"
        `);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "waitList"`);
    }

}
