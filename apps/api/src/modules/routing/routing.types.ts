import { ServiceType } from '../../database/enums/service-type.enum';
import {
  ProviderPurchaseRequest,
  ProviderPurchaseResult,
} from '../providers/provider-adapter';

export interface RoutePurchaseInput
  extends Omit<ProviderPurchaseRequest, 'serviceType'> {
  serviceType: ServiceType;
}

export interface RoutePurchaseAttempt {
  providerCode: string;
  result?: ProviderPurchaseResult;
  error?: string;
}

export interface RoutePurchaseResult {
  providerCode: string;
  result: ProviderPurchaseResult;
  attempts: RoutePurchaseAttempt[];
}
