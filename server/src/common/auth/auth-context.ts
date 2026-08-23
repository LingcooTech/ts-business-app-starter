import type { FastifyRequest } from 'fastify';

export type RequestPrincipal = {
  userId: string;
  sessionId: string;
  email: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    status: 'active' | 'disabled';
    emailVerifiedAt: Date | null;
    createdAt: Date;
  };
  csrfToken: string;
  expiresAt: Date;
  permissions: ReadonlySet<string>;
};

export type AuthenticatedRequest = FastifyRequest & { principal?: RequestPrincipal };
