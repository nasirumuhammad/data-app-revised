import { ServiceType } from '../../database/enums/service-type.enum';

export interface ProviderPurchaseRequest {
  reference: string;
  serviceType: ServiceType;
  productCode: string;
  recipient: string;
  amount: string;
  currency: string;
  metadata?: Record<string, unknown>;
}

export enum ProviderOperationStatus {
  SUCCESS = 'SUCCESS',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

export interface ProviderPurchaseResult {
  status: ProviderOperationStatus;
  /** Whether the router may safely try another provider. */
  retryable?: boolean;
  providerReference?: string;
  message?: string;
  raw?: Record<string, unknown>;
}

export interface ProviderStatusResult {
  status: ProviderOperationStatus;
  providerReference?: string;
  message?: string;
  raw?: Record<string, unknown>;
}

export interface ProviderBalanceResult {
  balance: string;
  currency: string;
  raw?: Record<string, unknown>;
}

/**
 * Thrown by an adapter ONLY when it is certain the purchase never reached the
 * provider (missing credentials, connection refused, local validation, ...).
 * The router may then safely try the next provider.
 *
 * Any other thrown error (timeout, reset connection, 5xx, parse failure) is
 * treated as ambiguous: the provider may already have fulfilled the order, so
 * the router must NOT fail over, or the customer could be served twice.
 */
export class ProviderRequestNotSentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderRequestNotSentError';
  }
}

export interface ProviderAdapter {
  readonly code: string;

  purchase(request: ProviderPurchaseRequest): Promise<ProviderPurchaseResult>;

  queryStatus(providerReference: string): Promise<ProviderStatusResult>;

  balance(): Promise<ProviderBalanceResult>;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');
