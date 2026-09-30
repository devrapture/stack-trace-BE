import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/error/app-error.js';
import { ErrorCode } from '../../common/error/error-codes.js';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../../email/email-provider.js';
import { accountEmail } from '../../email/templates/account-email.js';
import { normalizeEmail } from '../../users/normalize-email.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../users/users.repository.js';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerificationChallengesRepository,
} from './email-verification.repository.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OtpService,
} from './otp.service.js';
import {
  ResendVerificationDto,
  ResendVerificationResponseDto,
} from './resend-verification.dto.js';
import {
  VerifyEmailOtpDto,
  VerifyEmailResponseDto,
} from './verify-email.dto.js';

const GENERIC_RESEND_RESPONSE: ResendVerificationResponseDto = {
  message:
    'If this email is awaiting verification, a new verification code has been sent.',
};

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly userRepository: UsersRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly challengeRepository: EmailVerificationChallengesRepository,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    private readonly otpService: OtpService,
  ) {}

  async verify(dto: VerifyEmailOtpDto): Promise<VerifyEmailResponseDto> {
    const invalidCode = () =>
      new AppError(
        ErrorCode.BAD_REQUEST,
        'That code is invalid or expired. Request a new one',
        HttpStatus.BAD_REQUEST,
      );
    const { normalizedEmail } = normalizeEmail(dto.email);
    const user =
      await this.userRepository.getUserByNormalizedEmail(normalizedEmail);
    if (!user) throw invalidCode();

    const challenge = await this.challengeRepository.findActive(
      user.id,
      'REGISTRATION',
    );

    if (!challenge) throw invalidCode();

    const isOtpValid = this.otpService.verify(dto.otp, challenge.otpHash);
    if (!isOtpValid) {
      await this.challengeRepository.incrementAttempts(challenge.id);
      throw invalidCode();
    }

    const consumed = await this.challengeRepository.consumeAndVerifyEmail(
      challenge.id,
      user.id,
    );
    if (!consumed) throw invalidCode();
    return { verified: true };
  }

  async resend(
    dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponseDto> {
    const { normalizedEmail } = normalizeEmail(dto.email);
    const user =
      await this.userRepository.getUserByNormalizedEmail(normalizedEmail);
    if (!user?.primaryEmail || user.primaryEmail.verified)
      return GENERIC_RESEND_RESPONSE;
    const otp = this.otpService.generate();
    const otpHash = this.otpService.hash(otp);
    await this.challengeRepository.issueWithCooldown({
      userId: user.id,
      purpose: 'REGISTRATION',
      otpHash,
      ttlMs: OTP_TTL_MS,
      cooldownMs: OTP_RESEND_COOLDOWN_MS,
      maxAttempts: OTP_MAX_ATTEMPTS,
    });

    await this.emailProvider.send({
      to: user.primaryEmail.normalized,
      ...accountEmail({
        type: 'registration_otp',
        otp,
        expiresInMinutes: OTP_TTL_MS / 60_000,
      }),
    });
    return GENERIC_RESEND_RESPONSE;
  }
}
