import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * One row per issued refresh token. Tokens are rotated on every use; all
 * tokens descended from one login share a `familyId`, so a replayed (already
 * rotated) token can revoke the whole session at once.
 */
@Entity('refresh_tokens')
@Index(['userId'])
@Index(['familyId'])
export class RefreshToken extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'uuid' })
  familyId!: string;

  /** HMAC-SHA256 of the token. The raw token is never stored. */
  @Column({ type: 'varchar', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent!: string | null;
}
