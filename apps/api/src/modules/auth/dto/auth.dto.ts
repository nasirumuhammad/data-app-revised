import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// bcrypt only looks at the first 72 bytes, so longer passwords are rejected
// instead of being silently truncated.
const PASSWORD_MIN_BYTES = 8;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_MESSAGE = `password must be between ${PASSWORD_MIN_BYTES} and ${PASSWORD_MAX_BYTES} bytes`;

const trimAndLowercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trimAndLowercase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsByteLength(PASSWORD_MIN_BYTES, PASSWORD_MAX_BYTES, {
    message: PASSWORD_MESSAGE,
  })
  password!: string;

  /** Nigerian mobile number: 08012345678 or +2348012345678. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '') : value,
  )
  @Matches(/^(?:\+234|0)[789][01]\d{8}$/, {
    message: 'phoneNumber must be a valid Nigerian mobile number',
  })
  phoneNumber?: string;
}

export class LoginDto {
  @Transform(trimAndLowercase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Not length-checked on login: only registration and password changes
  // enforce the policy. Capped so nobody can submit megabytes to bcrypt.
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MaxLength(256)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsByteLength(PASSWORD_MIN_BYTES, PASSWORD_MAX_BYTES, {
    message: `new ${PASSWORD_MESSAGE}`,
  })
  newPassword!: string;
}
