import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePortfolioItems1778600000000 implements MigrationInterface {
  name = 'CreatePortfolioItems1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portfolio_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "description" text,
        "project_url" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portfolio_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_portfolio_items_user_id" ON "portfolio_items" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_portfolio_items_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio_items"`);
  }
}
