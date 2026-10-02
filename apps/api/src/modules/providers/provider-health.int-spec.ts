import { DataSource } from 'typeorm';

import { Provider } from '../../database/entities/provider.entity';
import { createTestDataSource } from '../../testing/test-database';
import { ProviderHealthService } from './provider-health.service';

jest.setTimeout(30_000);

describe('provider health (real Postgres)', () => {
  let dataSource: DataSource;
  let health: ProviderHealthService;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    health = new ProviderHealthService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const create = () =>
    dataSource
      .getRepository(Provider)
      .save({ code: `P_${Date.now()}_${Math.random()}`, name: 'Test' });

  const reload = (id: string) =>
    dataSource.getRepository(Provider).findOneByOrFail({ id });

  it('opens the circuit on the third consecutive failure', async () => {
    const provider = await create();

    await health.recordFailure(provider.id);
    await health.recordFailure(provider.id);
    expect((await reload(provider.id)).circuitOpenedAt).toBeNull();

    await health.recordFailure(provider.id);
    const after = await reload(provider.id);
    expect(after.consecutiveFailures).toBe(3);
    expect(after.circuitOpenedAt).not.toBeNull();
    expect(health.isHealthy(after)).toBe(false);
  });

  it('counts every failure when they arrive concurrently', async () => {
    const provider = await create();

    await Promise.all(
      Array.from({ length: 10 }, () => health.recordFailure(provider.id)),
    );

    expect((await reload(provider.id)).consecutiveFailures).toBe(10);
  });

  it('closes the circuit and resets the counter on success', async () => {
    const provider = await create();
    for (let i = 0; i < 3; i++) await health.recordFailure(provider.id);

    await health.recordSuccess(provider.id);

    const after = await reload(provider.id);
    expect(after.consecutiveFailures).toBe(0);
    expect(after.circuitOpenedAt).toBeNull();
  });

  it('does not touch a healthy provider row on success', async () => {
    const provider = await create();
    const before = await reload(provider.id);

    await health.recordSuccess(provider.id);

    expect((await reload(provider.id)).updatedAt).toEqual(before.updatedAt);
  });

  it('reports an unknown provider on failure', async () => {
    await expect(
      health.recordFailure('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/Provider not found/);
  });
});
