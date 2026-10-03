import { ServiceType } from '../../database/enums/service-type.enum';
import {
  ProviderPurchaseRequest,
  ProviderPurchaseResult,
} from '../providers/provider-adapter';

export interface RoutePurchaseInput extends Omit<
  ProviderPurchaseRequest,
  'serviceType'
> {
  serviceType: ServiceType;

  onAttemptStart?: (input: {
    providerId: string;
    providerCode: string;
    attemptNumber: number;
    startedAt: Date;
  }) => Promise<void>;

  onAttemptComplete?: (input: {
    providerId: string;
    providerCode: string;
    attemptNumber: number;
    startedAt: Date;
    completedAt: Date;
    result?: ProviderPurchaseResult;
    error?: string;
  }) => Promise<void>;
}

export interface RoutePurchaseAttempt {
  providerId: string;
  providerCode: string;
  attemptNumber: number;
  startedAt: Date;
  completedAt: Date;
  result?: ProviderPurchaseResult;
  error?: string;
}

export interface RoutePurchaseResult {
  providerCode: string;
  result: ProviderPurchaseResult;
  attempts: RoutePurchaseAttempt[];
}
