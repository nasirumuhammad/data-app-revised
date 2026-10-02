import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProviderRoutingState1790860858220 implements MigrationInterface {
  name = 'ProviderRoutingState1790860858220';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "providers" ADD "consecutiveFailures" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ADD "lastFailureAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ADD "circuitOpenedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_capabilities" ADD "cost" numeric(19,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_capabilities" DROP COLUMN "cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" DROP COLUMN "circuitOpenedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" DROP COLUMN "lastFailureAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" DROP COLUMN "consecutiveFailures"`,
    );
  }
}
