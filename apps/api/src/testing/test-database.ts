import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

config({ quiet: true });

/**
 * Connects to a dedicated, migrated test database. The name must end in
 * `_test`: these tests insert rows and race connections, so they must never
 * be pointed at a development or production database.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const database = process.env.TEST_DATABASE_NAME ?? 'data_app_test';

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${database}": the database name must end with "_test"`,
    );
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database,
    entities: [join(__dirname, '../database/entities/*.entity.{ts,js}')],
    migrations: [join(__dirname, '../database/migrations/*.{ts,js}')],
    extra: { max: 20 },
  });

  await dataSource.initialize();
  await dataSource.runMigrations();

  return dataSource;
}
