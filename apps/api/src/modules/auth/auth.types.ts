import type { Request } from 'express';

import { UserRole } from '../../database/enums/user-role.enum';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}
