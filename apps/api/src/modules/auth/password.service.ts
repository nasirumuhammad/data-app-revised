import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

import authConfig from '../../config/auth.config';

@Injectable()
export class PasswordService {
  private readonly dummyHash: Promise<string>;

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {
    // Same cost factor as real hashes, so comparing against it takes as long.
    this.dummyHash = bcrypt.hash(
      randomBytes(16).toString('hex'),
      config.bcryptRounds,
    );
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Spends the same time as a real check when the account does not exist. */
  async burn(password: string): Promise<void> {
    await bcrypt.compare(password, await this.dummyHash);
  }
}
