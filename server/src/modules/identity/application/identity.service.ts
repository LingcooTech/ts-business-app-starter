import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword, needsPasswordRehash, verifyPassword } from '@lingcoo-tech/security/password';
import type {
  ChangePasswordRequest,
  ConfirmPasswordReset,
  LoginRequest,
} from '@ts-business-app-starter/contracts';

import type { PublicIdentityUser, ResolvedSession } from '../domain/identity.types';
import { IdentityRepository } from '../infrastructure/persistence/identity.repository';

type LoginResult = {
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
  user: PublicIdentityUser;
};

const invalidCredentials = () =>
  new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
const invalidActionToken = () =>
  new BadRequestException({
    code: 'INVALID_ACTION_TOKEN',
    message: 'Action token is invalid or expired',
  });

function token(): string {
  return randomBytes(32).toString('base64url');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class IdentityService {
  private readonly dummyPasswordHash = hashPassword('not-a-real-user-password');

  constructor(
    private readonly repository: IdentityRepository,
    private readonly config: ConfigService,
  ) {}

  async login(input: LoginRequest, userAgent: string | null): Promise<LoginResult> {
    const credential = await this.repository.findCredentialByEmail(input.email);
    const passwordHash = credential?.passwordHash ?? (await this.dummyPasswordHash);
    const valid = await verifyPassword(input.password, passwordHash);
    if (!credential || !valid || credential.user.status !== 'active') throw invalidCredentials();

    if (needsPasswordRehash(credential.passwordHash)) {
      await this.repository.updatePasswordHash(
        credential.user.id,
        await hashPassword(input.password),
      );
    }

    const sessionToken = token();
    const csrfToken = token();
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS') * 1000,
    );
    await this.repository.createSession({
      userId: credential.user.id,
      tokenDigest: digest(sessionToken),
      csrfDigest: digest(csrfToken),
      expiresAt,
      userAgent,
    });
    return { sessionToken, csrfToken, expiresAt, user: credential.user };
  }

  async resolveSession(sessionToken: string, csrfToken: string): Promise<ResolvedSession | null> {
    const session = await this.repository.resolveSession(digest(sessionToken));
    if (!session || !this.digestMatches(csrfToken, session.csrfDigest)) return null;
    await this.repository.touchSession(session.sessionId);
    return session;
  }

  async logout(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId);
  }

  async changePassword(userId: string, input: ChangePasswordRequest): Promise<void> {
    const credential = await this.repository.findCredentialByUserId(userId);
    if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) {
      throw invalidCredentials();
    }
    if (await verifyPassword(input.newPassword, credential.passwordHash)) {
      throw new BadRequestException({
        code: 'PASSWORD_REUSE',
        message: 'New password must differ from the current password',
      });
    }
    await this.repository.changePasswordAndRevokeSessions(
      userId,
      await hashPassword(input.newPassword),
    );
  }

  async requestPasswordReset(email: string): Promise<{ accepted: true; testToken?: string }> {
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.status !== 'active') return { accepted: true };
    const actionToken = token();
    await this.repository.createActionToken({
      userId: user.id,
      purpose: 'password_reset',
      tokenDigest: digest(actionToken),
      expiresAt: this.actionTokenExpiry(),
    });
    return this.exposedActionToken(actionToken);
  }

  async confirmPasswordReset(input: ConfirmPasswordReset): Promise<void> {
    const consumed = await this.repository.resetPasswordWithToken(
      digest(input.token),
      await hashPassword(input.newPassword),
    );
    if (!consumed) throw invalidActionToken();
  }

  async requestEmailVerification(userId: string): Promise<{ accepted: true; testToken?: string }> {
    const actionToken = token();
    await this.repository.createActionToken({
      userId,
      purpose: 'email_verification',
      tokenDigest: digest(actionToken),
      expiresAt: this.actionTokenExpiry(),
    });
    return this.exposedActionToken(actionToken);
  }

  async confirmEmailVerification(actionToken: string): Promise<void> {
    if (!(await this.repository.consumeEmailVerification(digest(actionToken)))) {
      throw invalidActionToken();
    }
  }

  async ensureBootstrapUser(email: string, password: string): Promise<PublicIdentityUser> {
    const existing = await this.repository.findUserByEmail(email);
    if (existing) return existing;
    return this.repository.createUser({
      email,
      passwordHash: await hashPassword(password),
      emailVerified: true,
    });
  }

  private digestMatches(value: string, expectedDigest: string): boolean {
    const actual = Buffer.from(digest(value));
    const expected = Buffer.from(expectedDigest);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private actionTokenExpiry(): Date {
    return new Date(
      Date.now() + this.config.getOrThrow<number>('AUTH_ACTION_TOKEN_TTL_SECONDS') * 1000,
    );
  }

  private exposedActionToken(actionToken: string): { accepted: true; testToken?: string } {
    return this.config.getOrThrow<boolean>('AUTH_EXPOSE_TEST_TOKENS')
      ? { accepted: true, testToken: actionToken }
      : { accepted: true };
  }
}
