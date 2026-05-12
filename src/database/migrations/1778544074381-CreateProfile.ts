import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProfile1778544074381 implements MigrationInterface {
    name = 'CreateProfile1778544074381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitList" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "emailSent" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c964d1d61359c1a9f8aa31eb0c2" UNIQUE ("email"), CONSTRAINT "PK_f96a6aa67f33d3613d1a7f904ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'user')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "full_name" character varying(255) NOT NULL, "role" "public"."users_role_enum", "auth_provider" character varying(50) NOT NULL DEFAULT 'email', "is_verified" boolean NOT NULL DEFAULT false, "onboarding_complete" boolean NOT NULL DEFAULT false, "otp_hash" character varying(255), "otp_expires_at" TIMESTAMP WITH TIME ZONE, "last_login_ip" character varying(45), "refresh_token_hash" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "username" character varying NOT NULL, "full_name" character varying NOT NULL, "bio" text, "photo_url" character varying, "template_type" character varying, "theme_settings" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d1ea35db5be7c08520d70dc03f8" UNIQUE ("username"), CONSTRAINT "REL_9e432b7df0d182f8d292902d1a" UNIQUE ("user_id"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reset_password" ("id" uuid NOT NULL, "userId" character varying NOT NULL, "tokenSelector" character varying(64) NOT NULL, "tokenHash" text NOT NULL, "used" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_82bffbeb85c5b426956d004a8f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2"`);
        await queryRunner.query(`DROP TABLE "reset_password"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "waitList"`);
    }

}
