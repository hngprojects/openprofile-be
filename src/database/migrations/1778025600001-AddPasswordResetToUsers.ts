import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPasswordResetToUsers1778025600001 implements MigrationInterface {
  name = 'AddPasswordResetToUsers1778025600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'password_reset_token_hash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'password_reset_expires',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'password_reset_expires');
    await queryRunner.dropColumn('users', 'password_reset_token_hash');
  }
}
