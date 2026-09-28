import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, type EmailProvider } from '../email/email-provider.js';
import { accountEmail } from '../email/templates/account-email.js';
import { normalizeEmail } from '../users/normalize-email.js';
import { UserProfile } from '../users/user.model.js';
import {
  UserEmailAlreadyExistsError,
  USERS_REPOSITORY,
  type UsersRepository,
} from '../users/users.repository.js';
import { RegisterDto, RegisterResponseDto } from './dto/register.dto.js';
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
  PASSWORD_CREDENTIALS_REPOSITORY,
  type PasswordCredentialsRepository,
} from './password/password-credentials.repository.js';
import { validatePassword } from './password/password-policy.js';
import { PasswordHasher } from './password/password.hasher.js';

const GENERIC_RESPONSE: RegisterResponseDto = {
  message:
    'Registration successful. Please check your email for a verification code.',
};

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly userService: UsersRepository,
    @Inject(PASSWORD_CREDENTIALS_REPOSITORY)
    private readonly passwordCredentialsRepository: PasswordCredentialsRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: EmailVerificationChallengesRepository,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    private readonly passwordHasher: PasswordHasher,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    validatePassword(dto.password);
    const { displayEmail, normalizedEmail } = normalizeEmail(dto.email);

    const existing =
      await this.userService.getUserByNormalizedEmail(normalizedEmail);

    if (existing) {
      await this.handleExistingEmail(existing, dto.password);
      return GENERIC_RESPONSE;
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const user = await this.userService.createWithPrimaryEmail({
        email: displayEmail,
      });
      await this.passwordCredentialsRepository.createForUser(
        user.id,
        passwordHash,
      );
      await this.issueAndSendOtp(user.id, displayEmail);
    } catch (error) {
      if (error instanceof UserEmailAlreadyExistsError) {
        return GENERIC_RESPONSE;
      }
      throw error;
    }

    return GENERIC_RESPONSE;
  }

  private async handleExistingEmail(
    user: UserProfile,
    password: string,
  ): Promise<void> {
    const primaryEmail = user.primaryEmail;
    if (!primaryEmail) {
      return;
    }

    const existingHash =
      await this.passwordCredentialsRepository.findHashByUserId(user.id);
    if (existingHash && (user.status !== 'PENDING' || primaryEmail.verified)) {
      await this.emailProvider.send({
        to: primaryEmail.normalized,
        ...accountEmail({
          type: 'existing_account_notice',
        }),
      });
      return;
    }

    if (existingHash) {
      const passwordHash = await this.passwordHasher.hash(password);
      await this.passwordCredentialsRepository.updateHashForUser(
        user.id,
        passwordHash,
      );

      await this.issueAndSendOtp(user.id, primaryEmail.normalized);
      return;
    }

    await this.emailProvider.send({
      to: primaryEmail.normalized,
      ...accountEmail({
        type: 'oauth_only_account_notice',
      }),
    });
  }

  private async issueAndSendOtp(
    userId: string,
    toEmail: string,
  ): Promise<void> {
    const otp = this.otpService.generate();
    const otpHash = this.otpService.hash(otp);

    await this.emailVerificationRepository.issueWithCooldown({
      userId,
      purpose: 'REGISTRATION',
      otpHash,
      ttlMs: OTP_TTL_MS,
      cooldownMs: OTP_RESEND_COOLDOWN_MS,
      maxAttempts: OTP_MAX_ATTEMPTS,
    });

    await this.emailProvider.send({
      to: toEmail,
      ...accountEmail({
        type: 'registration_otp',
        otp,
        expiresInMinutes: OTP_TTL_MS / 60_000,
      }),
    });
  }
}
