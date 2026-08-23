import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  acceptedActionSchema,
  apiErrorResponseSchema,
  currentPermissionsSchema,
  sessionIdentitySchema,
  type ChangePasswordRequest,
  type ConfirmPasswordReset,
  type CurrentPermissions,
  type LoginRequest,
  type SessionIdentity,
} from '@ts-business-app-starter/contracts';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { z, type ZodType } from 'zod';

const queryKeys = {
  session: ['identity', 'session'] as const,
  permissions: ['access', 'permissions'] as const,
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private csrfToken: string | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async login(input: LoginRequest): Promise<SessionIdentity> {
    const identity = await this.request('/api/auth/login', sessionIdentitySchema, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.csrfToken = identity.csrfToken;
    return identity;
  }

  async getSession(): Promise<SessionIdentity | null> {
    try {
      const identity = await this.request('/api/auth/me', sessionIdentitySchema);
      this.csrfToken = identity.csrfToken;
      return identity;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        this.csrfToken = null;
        return null;
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', acceptedActionSchema, { method: 'POST' });
    this.csrfToken = null;
  }

  async getPermissions(): Promise<CurrentPermissions> {
    return this.request('/api/access/permissions', currentPermissionsSchema);
  }

  async changePassword(input: ChangePasswordRequest): Promise<void> {
    await this.request('/api/auth/password/change', acceptedActionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.csrfToken = null;
  }

  async requestPasswordReset(email: string): Promise<{ testToken?: string }> {
    return this.request('/api/auth/password-reset/request', acceptedActionSchema, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async confirmPasswordReset(input: ConfirmPasswordReset): Promise<void> {
    await this.request('/api/auth/password-reset/confirm', acceptedActionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestEmailVerification(): Promise<{ testToken?: string }> {
    return this.request('/api/auth/email-verification/request', acceptedActionSchema, {
      method: 'POST',
    });
  }

  async confirmEmailVerification(token: string): Promise<void> {
    await this.request('/api/auth/email-verification/confirm', acceptedActionSchema, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  private async request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body) headers.set('content-type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) {
      headers.set('x-csrf-token', this.csrfToken);
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = apiErrorResponseSchema.safeParse(payload);
      if (parsed.success) {
        const error = parsed.data.error;
        throw new ApiRequestError(
          error.message,
          response.status,
          error.code,
          error.requestId,
          error.details,
        );
      }
      throw new ApiRequestError(
        `请求失败（HTTP ${response.status}）`,
        response.status,
        'HTTP_ERROR',
      );
    }
    return schema.parse(payload);
  }
}

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );
  return (
    <ApiContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApiClient must be used inside ApiProvider');
  return client;
}

export function useSession(): UseQueryResult<SessionIdentity | null> {
  const api = useApiClient();
  return useQuery({ queryKey: queryKeys.session, queryFn: () => api.getSession() });
}

export function usePermissions(enabled = true): UseQueryResult<CurrentPermissions> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => api.getPermissions(),
    enabled,
  });
}

export function useLogin() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => api.login(input),
    onSuccess: (identity) => {
      queryClient.setQueryData(queryKeys.session, identity);
      void queryClient.invalidateQueries({ queryKey: queryKeys.permissions });
    },
  });
}

export function useLogout() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.removeQueries({ queryKey: queryKeys.permissions });
    },
  });
}

export function useChangePassword() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordRequest) => api.changePassword(input),
    onSuccess: () => queryClient.setQueryData(queryKeys.session, null),
  });
}

export function useRequestPasswordReset() {
  const api = useApiClient();
  return useMutation({ mutationFn: (email: string) => api.requestPasswordReset(email) });
}

export function useConfirmPasswordReset() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (input: ConfirmPasswordReset) => api.confirmPasswordReset(input),
  });
}

export function useRequestEmailVerification() {
  const api = useApiClient();
  return useMutation({ mutationFn: () => api.requestEmailVerification() });
}

export function useConfirmEmailVerification() {
  const api = useApiClient();
  return useMutation({ mutationFn: (token: string) => api.confirmEmailVerification(token) });
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof z.ZodError) return '服务器响应与约定的数据格式不一致。';
  return '操作未完成，请稍后重试。';
}
