import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1790860858210 implements MigrationInterface {
    name = 'Initial1790860858210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."provider_capabilities_capability_enum" AS ENUM('AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'JAMB', 'WAEC', 'NIN_VERIFICATION', 'BVN_VERIFICATION', 'ACCOUNT_CREATION', 'TRANSFER')`);
        await queryRunner.query(`CREATE TABLE "provider_capabilities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "providerId" uuid NOT NULL, "capability" "public"."provider_capabilities_capability_enum" NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, "priority" integer NOT NULL DEFAULT '1', "configuration" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_f091e699c13c6f8fed4ecad165e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_915257dbd495d1921783d19171" ON "provider_capabilities"  ("providerId", "capability") `);
        await queryRunner.query(`CREATE TYPE "public"."providers_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`CREATE TABLE "providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "name" character varying NOT NULL, "status" "public"."providers_status_enum" NOT NULL DEFAULT 'ACTIVE', "isEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_cdc1db37b0ed3c1c6bc8c1f0458" UNIQUE ("code"), CONSTRAINT "PK_af13fc2ebf382fe0dad2e4793aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."financial_accounts_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "financial_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "providerId" uuid NOT NULL, "accountNumber" character varying, "accountName" character varying, "bankName" character varying, "bankCode" character varying, "providerReference" character varying, "status" "public"."financial_accounts_status_enum" NOT NULL DEFAULT 'PENDING', "currency" character varying NOT NULL DEFAULT 'NGN', CONSTRAINT "PK_e684ee5a80dfa62dfe64dd959d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3b7e7bca97e7165de3adf3b493" ON "financial_accounts"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bc9f228e36eb293fb00f86e635" ON "financial_accounts"  ("providerId", "providerReference") `);
        await queryRunner.query(`CREATE TYPE "public"."identity_verifications_capability_enum" AS ENUM('AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'JAMB', 'WAEC', 'NIN_VERIFICATION', 'BVN_VERIFICATION', 'ACCOUNT_CREATION', 'TRANSFER')`);
        await queryRunner.query(`CREATE TYPE "public"."identity_verifications_status_enum" AS ENUM('PENDING', 'VERIFIED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "identity_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "capability" "public"."identity_verifications_capability_enum" NOT NULL, "status" "public"."identity_verifications_status_enum" NOT NULL DEFAULT 'PENDING', "providerId" uuid, "providerReference" character varying, "verifiedAt" TIMESTAMP WITH TIME ZONE, "failureReason" character varying, CONSTRAINT "PK_42a93e679bc1d9568b6e80ea080" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_49f27a1c897c7b2a213e2d5081" ON "identity_verifications"  ("userId", "capability") `);
        await queryRunner.query(`CREATE TYPE "public"."wallets_status_enum" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED')`);
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "balance" numeric(19,2) NOT NULL DEFAULT '0', "availableBalance" numeric(19,2) NOT NULL DEFAULT '0', "reservedBalance" numeric(19,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'NGN', "status" "public"."wallets_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "REL_2ecdb33f23e9a6fc392025c0b9" UNIQUE ("userId"), CONSTRAINT "CHK_wallets_reserved_non_negative" CHECK ("reservedBalance" >= 0), CONSTRAINT "CHK_wallets_available_non_negative" CHECK ("availableBalance" >= 0), CONSTRAINT "CHK_wallets_balance_non_negative" CHECK ("balance" >= 0), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ledger_entries_type_enum" AS ENUM('CREDIT', 'DEBIT', 'REVERSAL', 'FEE', 'COMMISSION')`);
        await queryRunner.query(`CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "walletId" uuid NOT NULL, "type" "public"."ledger_entries_type_enum" NOT NULL, "amount" numeric(19,2) NOT NULL, "balanceBefore" numeric(19,2) NOT NULL, "balanceAfter" numeric(19,2) NOT NULL, "transactionId" uuid, "reference" character varying, "description" character varying, "metadata" jsonb, CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9c307cfbc08071a3309ab799a0" ON "ledger_entries"  ("transactionId", "type") WHERE "transactionId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_e53ac39c3b4a414582e15c0baa" ON "ledger_entries"  ("walletId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_attempts_status_enum" AS ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'UNKNOWN')`);
        await queryRunner.query(`CREATE TABLE "transaction_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "transactionId" uuid NOT NULL, "providerId" uuid NOT NULL, "attemptNumber" integer NOT NULL, "status" "public"."transaction_attempts_status_enum" NOT NULL DEFAULT 'PENDING', "providerReference" character varying, "errorCode" character varying, "errorMessage" character varying, "requestPayload" jsonb, "responsePayload" jsonb, "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_05630f10345ebd11091283becb1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0da19e1d6771d0bcd53c20d7b6" ON "transaction_attempts"  ("providerId", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cf6520b3c4fe35601e22edc560" ON "transaction_attempts"  ("transactionId", "attemptNumber") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_servicetype_enum" AS ENUM('AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'JAMB', 'WAEC')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'UNKNOWN', 'REVERSED')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "walletId" uuid NOT NULL, "providerId" uuid, "serviceType" "public"."transactions_servicetype_enum" NOT NULL, "recipient" character varying, "productCode" character varying, "amount" numeric(19,2) NOT NULL, "fee" numeric(19,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'NGN', "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "reference" character varying NOT NULL, "idempotencyKey" character varying NOT NULL, "providerReference" character varying, "completedAt" TIMESTAMP WITH TIME ZONE, "failureReason" character varying, "metadata" jsonb, CONSTRAINT "UQ_dd85cc865e0c3d5d4be095d3f3f" UNIQUE ("reference"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5dc7be0581e635b1bb55caea1b" ON "transactions"  ("status", "createdAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_84be81bbd2ea1bf8fd87731567" ON "transactions"  ("userId", "idempotencyKey") `);
        await queryRunner.query(`CREATE INDEX "IDX_b467b9b4b250c7591c883294ca" ON "transactions"  ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'STAFF')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "phoneNumber" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."auth_identities_provider_enum" AS ENUM('PASSWORD', 'GOOGLE')`);
        await queryRunner.query(`CREATE TABLE "auth_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "provider" "public"."auth_identities_provider_enum" NOT NULL, "providerAccountId" character varying, "passwordHash" character varying, CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6ed26ac7e2276ae145ca68c23a" ON "auth_identities"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5ce35768e02c2e0824adcb6ff3" ON "auth_identities"  ("provider", "providerAccountId") `);
        await queryRunner.query(`ALTER TABLE "provider_capabilities" ADD CONSTRAINT "FK_a9109d7ed058849eea8bfea9c6f" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "financial_accounts" ADD CONSTRAINT "FK_3b7e7bca97e7165de3adf3b4931" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "financial_accounts" ADD CONSTRAINT "FK_01a625b0f6993e2876e5a96dddb" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "identity_verifications" ADD CONSTRAINT "FK_83273c13b0844ed35d309abaebb" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "identity_verifications" ADD CONSTRAINT "FK_362c00deb73b614f204c87cbc9d" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_df977c08d98fab6543724d74859" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_ce01dd5f8bde23f503bf01ffacc" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_attempts" ADD CONSTRAINT "FK_df2596536fc11794467e902d1d9" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_attempts" ADD CONSTRAINT "FK_8c8119fb60d4cabb9d897bcdf9f" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_a88f466d39796d3081cf96e1b66" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_c2625e9d1fd0315146b768dc4aa" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_c2625e9d1fd0315146b768dc4aa"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_a88f466d39796d3081cf96e1b66"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`);
        await queryRunner.query(`ALTER TABLE "transaction_attempts" DROP CONSTRAINT "FK_8c8119fb60d4cabb9d897bcdf9f"`);
        await queryRunner.query(`ALTER TABLE "transaction_attempts" DROP CONSTRAINT "FK_df2596536fc11794467e902d1d9"`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_ce01dd5f8bde23f503bf01ffacc"`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_df977c08d98fab6543724d74859"`);
        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`);
        await queryRunner.query(`ALTER TABLE "identity_verifications" DROP CONSTRAINT "FK_362c00deb73b614f204c87cbc9d"`);
        await queryRunner.query(`ALTER TABLE "identity_verifications" DROP CONSTRAINT "FK_83273c13b0844ed35d309abaebb"`);
        await queryRunner.query(`ALTER TABLE "financial_accounts" DROP CONSTRAINT "FK_01a625b0f6993e2876e5a96dddb"`);
        await queryRunner.query(`ALTER TABLE "financial_accounts" DROP CONSTRAINT "FK_3b7e7bca97e7165de3adf3b4931"`);
        await queryRunner.query(`ALTER TABLE "provider_capabilities" DROP CONSTRAINT "FK_a9109d7ed058849eea8bfea9c6f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ce35768e02c2e0824adcb6ff3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6ed26ac7e2276ae145ca68c23a"`);
        await queryRunner.query(`DROP TABLE "auth_identities"`);
        await queryRunner.query(`DROP TYPE "public"."auth_identities_provider_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b467b9b4b250c7591c883294ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_84be81bbd2ea1bf8fd87731567"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5dc7be0581e635b1bb55caea1b"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_servicetype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf6520b3c4fe35601e22edc560"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0da19e1d6771d0bcd53c20d7b6"`);
        await queryRunner.query(`DROP TABLE "transaction_attempts"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_attempts_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e53ac39c3b4a414582e15c0baa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c307cfbc08071a3309ab799a0"`);
        await queryRunner.query(`DROP TABLE "ledger_entries"`);
        await queryRunner.query(`DROP TYPE "public"."ledger_entries_type_enum"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TYPE "public"."wallets_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49f27a1c897c7b2a213e2d5081"`);
        await queryRunner.query(`DROP TABLE "identity_verifications"`);
        await queryRunner.query(`DROP TYPE "public"."identity_verifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."identity_verifications_capability_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc9f228e36eb293fb00f86e635"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b7e7bca97e7165de3adf3b493"`);
        await queryRunner.query(`DROP TABLE "financial_accounts"`);
        await queryRunner.query(`DROP TYPE "public"."financial_accounts_status_enum"`);
        await queryRunner.query(`DROP TABLE "providers"`);
        await queryRunner.query(`DROP TYPE "public"."providers_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_915257dbd495d1921783d19171"`);
        await queryRunner.query(`DROP TABLE "provider_capabilities"`);
        await queryRunner.query(`DROP TYPE "public"."provider_capabilities_capability_enum"`);
    }

}
