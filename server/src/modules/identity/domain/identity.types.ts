export type ActionTokenPurpose = 'email_verification' | 'password_reset';

export type PublicIdentityUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: 'active' | 'disabled';
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export type ResolvedSession = {
  sessionId: string;
  csrfDigest: string;
  expiresAt: Date;
  user: PublicIdentityUser;
};
