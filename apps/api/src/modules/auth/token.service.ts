import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes } from 'node:crypto';

import authConfig from '../../config/auth.config';

const ISSUER = 'data-app-api';
const AUDIENCE = 'data-app-clients';
const ALGORITHM = 'HS256';

interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.accessTtlSeconds;
  }

  get refreshTtlMs(): number {
    return this.config.refreshTtlDays * 24 * 60 * 60 * 1000;
  }

  signAccessToken(userId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, typ: 'access' };

    return this.jwt.signAsync(payload, {
      secret: this.config.accessSecret,
      algorithm: ALGORITHM,
      expiresIn: this.config.accessTtlSeconds,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  /** Returns the user id, or throws 401 for any invalid token. */
  async verifyAccessToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.accessSecret,
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
        throw new Error('Not an access token');
      }

      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /** Opaque, 256-bit random token. Only its hash is stored. */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.refreshSecret)
      .update(token)
      .digest('hex');
  }
}
