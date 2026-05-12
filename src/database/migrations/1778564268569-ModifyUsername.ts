import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyUsername1778564268569 implements MigrationInterface {
    name = 'ModifyUsername1778564268569'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."users_username_unique_idx"`);
        await queryRunner.query(`DROP INDEX "public"."users_full_name_trgm_idx"`);
        await queryRunner.query(`DROP INDEX "public"."users_username_trgm_idx"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reset_password_tokenSelector"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_reset_token_hash"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_reset_expires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
        await queryRunner.query(`ALTER TABLE "waitList" ADD CONSTRAINT "UQ_c964d1d61359c1a9f8aa31eb0c2" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`);
        await queryRunner.query(`ALTER TABLE "reset_password" ALTER COLUMN "tokenSelector" DROP DEFAULT`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`ALTER TABLE "reset_password" ALTER COLUMN "tokenSelector" SET DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "waitList" DROP CONSTRAINT "UQ_c964d1d61359c1a9f8aa31eb0c2"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "provider" character varying(32) NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "password_reset_expires" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "password_reset_token_hash" character varying(64)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_reset_password_tokenSelector" ON "reset_password" ("tokenSelector") `);
        await queryRunner.query(`CREATE INDEX "users_username_trgm_idx" ON "users" ("username") `);
        await queryRunner.query(`CREATE INDEX "users_full_name_trgm_idx" ON "users" ("full_name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "users_username_unique_idx" ON "users" ("username") WHERE (username IS NOT NULL)`);
    }

}
