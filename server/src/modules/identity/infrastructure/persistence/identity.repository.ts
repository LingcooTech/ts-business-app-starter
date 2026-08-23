import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../../common/database/database.port';
import type {
  ActionTokenPurpose,
  PublicIdentityUser,
  ResolvedSession,
} from '../../domain/identity.types';
import {
  identityActionTokens,
  identityPasswordCredentials,
  identitySessions,
  identityUsers,
} from './identity.schema';

type Credential = { user: PublicIdentityUser; passwordHash: string };

function publicUser(user: typeof identityUsers.$inferSelect): PublicIdentityUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class IdentityRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async findCredentialByEmail(email: string): Promise<Credential | null> {
    const [record] = await this.database
      .select({ user: identityUsers, passwordHash: identityPasswordCredentials.passwordHash })
      .from(identityUsers)
      .innerJoin(
        identityPasswordCredentials,
        eq(identityPasswordCredentials.userId, identityUsers.id),
      )
      .where(eq(identityUsers.email, email))
      .limit(1);
    return record ? { user: publicUser(record.user), passwordHash: record.passwordHash } : null;
  }

  async findCredentialByUserId(userId: string): Promise<Credential | null> {
    const [record] = await this.database
      .select({ user: identityUsers, passwordHash: identityPasswordCredentials.passwordHash })
      .from(identityUsers)
      .innerJoin(
        identityPasswordCredentials,
        eq(identityPasswordCredentials.userId, identityUsers.id),
      )
      .where(eq(identityUsers.id, userId))
      .limit(1);
    return record ? { user: publicUser(record.user), passwordHash: record.passwordHash } : null;
  }

  async findUserByEmail(email: string): Promise<PublicIdentityUser | null> {
    const [user] = await this.database
      .select()
      .from(identityUsers)
      .where(eq(identityUsers.email, email))
      .limit(1);
    return user ? publicUser(user) : null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    emailVerified: boolean;
  }): Promise<PublicIdentityUser> {
    return this.database.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(identityUsers)
        .values({
          email: input.email,
          emailVerifiedAt: input.emailVerified ? new Date() : null,
        })
        .returning();
      if (!user) throw new Error('Failed to create identity user');
      await transaction.insert(identityPasswordCredentials).values({
        userId: user.id,
        passwordHash: input.passwordHash,
      });
      return publicUser(user);
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.database
      .update(identityPasswordCredentials)
      .set({ passwordHash, passwordChangedAt: new Date() })
      .where(eq(identityPasswordCredentials.userId, userId));
  }

  async changePasswordAndRevokeSessions(userId: string, passwordHash: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(identityPasswordCredentials)
        .set({ passwordHash, passwordChangedAt: new Date() })
        .where(eq(identityPasswordCredentials.userId, userId));
      await transaction
        .update(identitySessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(identitySessions.userId, userId), isNull(identitySessions.revokedAt)));
    });
  }

  async createSession(input: {
    userId: string;
    tokenDigest: string;
    csrfDigest: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<{ id: string; expiresAt: Date }> {
    const [session] = await this.database.insert(identitySessions).values(input).returning({
      id: identitySessions.id,
      expiresAt: identitySessions.expiresAt,
    });
    if (!session) throw new Error('Failed to create identity session');
    return session;
  }

  async resolveSession(tokenDigest: string): Promise<ResolvedSession | null> {
    const [record] = await this.database
      .select({ session: identitySessions, user: identityUsers })
      .from(identitySessions)
      .innerJoin(identityUsers, eq(identityUsers.id, identitySessions.userId))
      .where(
        and(
          eq(identitySessions.tokenDigest, tokenDigest),
          isNull(identitySessions.revokedAt),
          gt(identitySessions.expiresAt, new Date()),
          eq(identityUsers.status, 'active'),
        ),
      )
      .limit(1);
    if (!record) return null;
    return {
      sessionId: record.session.id,
      csrfDigest: record.session.csrfDigest,
      expiresAt: record.session.expiresAt,
      user: publicUser(record.user),
    };
  }

  async touchSession(sessionId: string): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await this.database
      .update(identitySessions)
      .set({ lastSeenAt: new Date() })
      .where(
        and(eq(identitySessions.id, sessionId), lt(identitySessions.lastSeenAt, fiveMinutesAgo)),
      );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.database
      .update(identitySessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(identitySessions.id, sessionId), isNull(identitySessions.revokedAt)));
  }

  async createActionToken(input: {
    userId: string;
    purpose: ActionTokenPurpose;
    tokenDigest: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(identityActionTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(identityActionTokens.userId, input.userId),
            eq(identityActionTokens.purpose, input.purpose),
            isNull(identityActionTokens.consumedAt),
          ),
        );
      await transaction.insert(identityActionTokens).values(input);
    });
  }

  async consumeEmailVerification(tokenDigest: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [token] = await transaction
        .update(identityActionTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(identityActionTokens.tokenDigest, tokenDigest),
            eq(identityActionTokens.purpose, 'email_verification'),
            isNull(identityActionTokens.consumedAt),
            gt(identityActionTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: identityActionTokens.userId });
      if (!token) return false;
      await transaction
        .update(identityUsers)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(identityUsers.id, token.userId));
      return true;
    });
  }

  async resetPasswordWithToken(tokenDigest: string, passwordHash: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [token] = await transaction
        .update(identityActionTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(identityActionTokens.tokenDigest, tokenDigest),
            eq(identityActionTokens.purpose, 'password_reset'),
            isNull(identityActionTokens.consumedAt),
            gt(identityActionTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: identityActionTokens.userId });
      if (!token) return false;
      await transaction
        .update(identityPasswordCredentials)
        .set({ passwordHash, passwordChangedAt: new Date() })
        .where(eq(identityPasswordCredentials.userId, token.userId));
      await transaction
        .update(identitySessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(identitySessions.userId, token.userId), isNull(identitySessions.revokedAt)));
      return true;
    });
  }
}
