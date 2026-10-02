import { ServiceUnavailableException } from '@nestjs/common';

// @nestjs/typeorm v12 is ESM-only and jest runs these files as CommonJS. Only
// the decorator is needed here, and the repository is injected by hand.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ServiceType } from '../../database/enums/service-type.enum';
import {
  ProviderAdapter,
  ProviderOperationStatus,
  ProviderRequestNotSentError,
} from '../providers/provider-adapter';
import { RoutingService } from './routing.service';

const INPUT = {
  reference: 'TXN_1',
  serviceType: ServiceType.AIRTIME,
  productCode: 'MTN_100',
  recipient: '08030000000',
  amount: '100.00',
  currency: 'NGN',
};

function capability(code: string, cost: string | null, priority = 1) {
  return {
    cost,
    priority,
    provider: { id: `id-${code}`, code },
  };
}

function setup(
  capabilities: ReturnType<typeof capability>[],
  adapters: Record<string, Partial<ProviderAdapter>>,
) {
  const repository = { find: jest.fn().mockResolvedValue(capabilities) };
  const registry = { get: jest.fn((code: string) => adapters[code]) };
  const health = {
    isHealthy: jest.fn().mockReturnValue(true),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };

  const service = new RoutingService(
    repository as never,
    registry as never,
    health as never,
  );

  return { service, health, registry };
}

const ok = { status: ProviderOperationStatus.SUCCESS, providerReference: 'p1' };

describe('RoutingService', () => {
  it('tries the cheapest provider first, then priority, with unknown cost last', async () => {
    const calls: string[] = [];
    const adapter = (code: string): Partial<ProviderAdapter> => ({
      purchase: jest.fn(() => {
        calls.push(code);
        return Promise.resolve({
          status: ProviderOperationStatus.FAILED,
          retryable: true,
        });
      }),
    });

    const { service } = setup(
      [
        capability('NOCOST', null, 1),
        capability('B', '95.00', 2),
        capability('A', '95.00', 1),
        capability('CHEAP', '90.00', 9),
      ],
      {
        NOCOST: adapter('NOCOST'),
        A: adapter('A'),
        B: adapter('B'),
        CHEAP: adapter('CHEAP'),
      },
    );

    await expect(service.purchase(INPUT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(calls).toEqual(['CHEAP', 'A', 'B', 'NOCOST']);
  });

  it('returns the first success and records provider health', async () => {
    const { service, health } = setup([capability('A', '90.00')], {
      A: { purchase: jest.fn().mockResolvedValue(ok) },
    });

    const result = await service.purchase(INPUT);

    expect(result.providerCode).toBe('A');
    expect(result.result.status).toBe(ProviderOperationStatus.SUCCESS);
    expect(health.recordSuccess).toHaveBeenCalledWith('id-A');
  });

  it('fails over after a retryable FAILED result and counts it against the provider', async () => {
    const { service, health } = setup(
      [capability('A', '90.00'), capability('B', '95.00')],
      {
        A: {
          purchase: jest.fn().mockResolvedValue({
            status: ProviderOperationStatus.FAILED,
            retryable: true,
          }),
        },
        B: { purchase: jest.fn().mockResolvedValue(ok) },
      },
    );

    const result = await service.purchase(INPUT);

    expect(result.providerCode).toBe('B');
    expect(health.recordFailure).toHaveBeenCalledWith('id-A');
  });

  it('does not fail over on a business failure, and does not trip the circuit', async () => {
    const second = jest.fn();
    const { service, health } = setup(
      [capability('A', '90.00'), capability('B', '95.00')],
      {
        A: {
          purchase: jest.fn().mockResolvedValue({
            status: ProviderOperationStatus.FAILED,
            retryable: false,
            message: 'Invalid recipient',
          }),
        },
        B: { purchase: second },
      },
    );

    const result = await service.purchase(INPUT);

    expect(result.result.status).toBe(ProviderOperationStatus.FAILED);
    expect(second).not.toHaveBeenCalled();
    expect(health.recordFailure).not.toHaveBeenCalled();
  });

  it.each([ProviderOperationStatus.PENDING, ProviderOperationStatus.UNKNOWN])(
    'does not fail over after a %s result (duplicate-purchase risk)',
    async (status) => {
      const second = jest.fn();
      const { service } = setup(
        [capability('A', '90.00'), capability('B', '95.00')],
        {
          A: { purchase: jest.fn().mockResolvedValue({ status }) },
          B: { purchase: second },
        },
      );

      const result = await service.purchase(INPUT);

      expect(result.result.status).toBe(status);
      expect(second).not.toHaveBeenCalled();
    },
  );

  it('fails over when the adapter proves the request was never sent', async () => {
    const { service, health } = setup(
      [capability('A', '90.00'), capability('B', '95.00')],
      {
        A: {
          purchase: jest
            .fn()
            .mockRejectedValue(
              new ProviderRequestNotSentError('no credentials'),
            ),
        },
        B: { purchase: jest.fn().mockResolvedValue(ok) },
      },
    );

    const result = await service.purchase(INPUT);

    expect(result.providerCode).toBe('B');
    expect(result.attempts[0]).toMatchObject({
      providerCode: 'A',
      error: 'no credentials',
    });
    expect(health.recordFailure).toHaveBeenCalledWith('id-A');
  });

  it('returns UNKNOWN and does NOT fail over on an ambiguous error such as a timeout', async () => {
    const second = jest.fn();
    const { service, health } = setup(
      [capability('A', '90.00'), capability('B', '95.00')],
      {
        A: { purchase: jest.fn().mockRejectedValue(new Error('timeout')) },
        B: { purchase: second },
      },
    );

    const result = await service.purchase(INPUT);

    expect(result.providerCode).toBe('A');
    expect(result.result.status).toBe(ProviderOperationStatus.UNKNOWN);
    expect(second).not.toHaveBeenCalled();
    expect(health.recordFailure).toHaveBeenCalledWith('id-A');
  });

  it('throws when no healthy provider exists', async () => {
    const { service, health } = setup([capability('A', '90.00')], {});
    health.isHealthy.mockReturnValue(false);

    await expect(service.purchase(INPUT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('is not affected by a failing health update after a successful purchase', async () => {
    const { service, health } = setup([capability('A', '90.00')], {
      A: { purchase: jest.fn().mockResolvedValue(ok) },
    });
    health.recordSuccess.mockRejectedValue(new Error('db down'));

    const result = await service.purchase(INPUT);

    expect(result.result.status).toBe(ProviderOperationStatus.SUCCESS);
  });
});
