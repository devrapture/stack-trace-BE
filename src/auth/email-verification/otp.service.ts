import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1_000;

@Injectable()
export class OtpService {
  constructor(
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
  ) {}

  generate(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }

  hash(otp: string): string {
    return createHmac('sha256', this.config.otpHashSecret)
      .update(otp)
      .digest('hex');
  }

  verify(otp: string, hash: string): boolean {
    const _otp = Buffer.from(this.hash(otp), 'hex');
    const _hash = Buffer.from(hash, 'hex');

    if (_otp.length !== _hash.length) return false;
    return timingSafeEqual(_otp, _hash);
  }
}
