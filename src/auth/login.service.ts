import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/error/app-error.js';
import { ErrorCode } from '../common/error/error-codes.js';
import {
  DeviceInfo,
  IssuedSession,
  SessionService,
} from '../sessions/session.service.js';
import { normalizeEmail } from '../users/normalize-email.js';
import { UserProfile } from '../users/user.model.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../users/users.repository.js';
import { LoginDto } from './dto/login.dto.js';
import {
  PASSWORD_CREDENTIALS_REPOSITORY,
  type PasswordCredentialsRepository,
} from './password/password-credentials.repository.js';
import { PasswordHasher } from './password/password.hasher.js';

export interface LoginResult {
  user: UserProfile;
  session: IssuedSession;
}

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$AP54XtD2meiQRccO8glIIw$REAqEvHLF6zWkDgSKlIju3U0nD4nbeUI1JF4Y+92BRM';

@Injectable()
export class LoginService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly userRepository: UsersRepository,
    @Inject(PASSWORD_CREDENTIALS_REPOSITORY)
    private readonly passwordCredentialsRepository: PasswordCredentialsRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionService: SessionService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const { normalizedEmail } = normalizeEmail(dto.email);
    const user =
      await this.userRepository.getUserByNormalizedEmail(normalizedEmail);

    const passwordHash = user
      ? await this.passwordCredentialsRepository.findHashByUserId(user.id)
      : null;

    const isPasswordValid = await this.passwordHasher.verify(
      passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (!user || !passwordHash || !isPasswordValid)
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );

    if (!user.primaryEmail?.verified)
      throw new AppError(
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Please verify your email before logging in.',
        HttpStatus.FORBIDDEN,
      );

    if (this.passwordHasher.needsRehash(passwordHash)) {
      const upgradedHash = await this.passwordHasher.hash(dto.password);
      await this.passwordCredentialsRepository.updateHashForUser(
        user.id,
        upgradedHash,
      );
    }

    const deviceInfo: DeviceInfo = {
      clientType: dto.clientType,
      ...(dto.deviceName
        ? {
            deviceName: dto.deviceName,
          }
        : {}),
    };

    const session = await this.sessionService.createSession(
      user.id,
      deviceInfo,
    );

    return {
      user,
      session,
    };
  }
}
