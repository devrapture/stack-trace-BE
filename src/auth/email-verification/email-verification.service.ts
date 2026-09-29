import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/error/app-error.js';
import { ErrorCode } from '../../common/error/error-codes.js';
import { normalizeEmail } from '../../users/normalize-email.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../users/users.repository.js';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerificationChallengesRepository,
} from './email-verification.repository.js';
import { OtpService } from './otp.service.js';
import {
  VerifyEmailOtpDto,
  VerifyEmailResponseDto,
} from './verify-email.dto.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly userRepository: UsersRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly challengeRepository: EmailVerificationChallengesRepository,
    private readonly otpService: OtpService,
  ) {}

  async verify(dto: VerifyEmailOtpDto): Promise<VerifyEmailResponseDto> {
    const { normalizedEmail } = normalizeEmail(dto.email);
    const user =
      await this.userRepository.getUserByNormalizedEmail(normalizedEmail);
    if (!user)
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'That code is invalid or expired.Request a new one',
        HttpStatus.BAD_REQUEST,
      );

    const challenge = await this.challengeRepository.findActive(
      user.id,
      'REGISTRATION',
    );

    if (!challenge)
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'That code is invalid or expired.Request a new one',
        HttpStatus.BAD_REQUEST,
      );

    const isOtpValid = this.otpService.verify(dto.otp, challenge.otpHash);
    if (!isOtpValid) {
      this.challengeRepository.incrementAttempts(challenge.id);
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'That code is invalid or expired.Request a new one',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.challengeRepository.consumeAndVerifyEmail(challenge.id, user.id);
    return { verified: true };
  }
}
