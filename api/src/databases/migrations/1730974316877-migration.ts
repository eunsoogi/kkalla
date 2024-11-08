import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1730974316877 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const openaiData = await queryRunner.manager
      .createQueryBuilder()
      .select(['id', 'user_id', 'secret_key', 'created_at', 'updated_at'])
      .from('apikey', 'apikey')
      .where('apikey.name = :type', { type: 'OPENAI' })
      .getRawMany();

    if (openaiData.length > 0) {
      await queryRunner.manager.createQueryBuilder().insert().into('openai_config').values(openaiData).execute();
    }

    const upbitData = await queryRunner.manager
      .createQueryBuilder()
      .select(['id', 'user_id', 'access_key', 'secret_key', 'created_at', 'updated_at'])
      .from('apikey', 'api')
      .where('api.name = :type', { type: 'UPBIT' })
      .getRawMany();

    if (upbitData.length > 0) {
      await queryRunner.manager.createQueryBuilder().insert().into('upbit_config').values(upbitData).execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.createQueryBuilder().delete().from('openai_config').execute();
    await queryRunner.manager.createQueryBuilder().delete().from('upbit_config').execute();
  }
}
