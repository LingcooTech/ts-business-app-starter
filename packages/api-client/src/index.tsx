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
  auditListResponseSchema,
  auditQuerySchema,
  apiErrorResponseSchema,
  currentPermissionsSchema,
  createAnnouncementRequestSchema,
  jobDetailSchema,
  jobListResponseSchema,
  jobQuerySchema,
  mailDeliveryListResponseSchema,
  mailDeliveryQuerySchema,
  notificationListResponseSchema,
  notificationQuerySchema,
  notificationSchema,
  outboxEventSchema,
  outboxListResponseSchema,
  outboxQuerySchema,
  queuedMailResponseSchema,
  retryJobResponseSchema,
  sendTestMailRequestSchema,
  unreadNotificationCountSchema,
  rotateSettingsResponseSchema,
  settingTestResponseSchema,
  settingViewSchema,
  settingsListResponseSchema,
  sessionIdentitySchema,
  type AuditQuery,
  type AuditLog,
  type CreateAnnouncementRequest,
  type ClearSettingRequest,
  type ChangePasswordRequest,
  type ConfirmPasswordReset,
  type CurrentPermissions,
  type LoginRequest,
  type Job,
  type JobDetail,
  type JobQuery,
  type MailDelivery,
  type MailDeliveryQuery,
  type Notification,
  type NotificationQuery,
  type OutboxEvent,
  type OutboxQuery,
  type PaginationMeta,
  type SaveSettingRequest,
  type SettingTestResponse,
  type SettingView,
  type SessionIdentity,
} from '@ts-business-app-starter/contracts';
import { ApiError } from '@lingcoo-tech/http';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { z, type ZodType } from 'zod';

const queryKeys = {
  session: ['identity', 'session'] as const,
  permissions: ['access', 'permissions'] as const,
  settings: ['settings'] as const,
  audit: (query: AuditQuery) => ['audit', query] as const,
  jobs: (query: JobQuery) => ['jobs', query] as const,
  outbox: (query: OutboxQuery) => ['outbox', query] as const,
  mail: (query: MailDeliveryQuery) => ['mail', query] as const,
  notifications: (query: NotificationQuery) => ['notifications', query] as const,
  unreadNotifications: ['notifications', 'unread-count'] as const,
};

export class ApiRequestError extends ApiError {
  constructor(
    message: string,
    status: number,
    code: string,
    public readonly requestId?: string,
    details?: unknown,
  ) {
    super(status, code, message, details);
    this.name = 'ApiRequestError';
  }

  get status(): number {
    return this.statusCode;
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

  async listSettings(): Promise<SettingView[]> {
    const response = await this.request('/api/settings', settingsListResponseSchema);
    return response.items;
  }

  async saveSetting(key: string, input: SaveSettingRequest): Promise<SettingView> {
    return this.request(`/api/settings/${encodeURIComponent(key)}`, settingViewSchema, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async clearSetting(key: string, input: ClearSettingRequest = {}): Promise<SettingView> {
    return this.request(`/api/settings/${encodeURIComponent(key)}`, settingViewSchema, {
      method: 'DELETE',
      body: JSON.stringify(input),
    });
  }

  async testSetting(key: string): Promise<SettingTestResponse> {
    return this.request(
      `/api/settings/${encodeURIComponent(key)}/test`,
      settingTestResponseSchema,
      { method: 'POST' },
    );
  }

  async rotateSettingSecrets(): Promise<{ rotated: number }> {
    return this.request('/api/settings/actions/rotate-secrets', rotateSettingsResponseSchema, {
      method: 'POST',
    });
  }

  async listAuditLogs(
    input: Partial<AuditQuery> = {},
  ): Promise<{ items: AuditLog[]; meta: PaginationMeta }> {
    const query = auditQuerySchema.parse(input);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    return this.request(`/api/audit?${search.toString()}`, auditListResponseSchema);
  }

  async listJobs(input: Partial<JobQuery> = {}): Promise<{ items: Job[]; meta: PaginationMeta }> {
    const query = jobQuerySchema.parse(input);
    return this.request(`/api/jobs?${this.queryString(query)}`, jobListResponseSchema);
  }

  async getJob(id: string): Promise<JobDetail> {
    return this.request(`/api/jobs/${encodeURIComponent(id)}`, jobDetailSchema);
  }

  async retryJob(id: string): Promise<Job> {
    const response = await this.request(
      `/api/jobs/${encodeURIComponent(id)}/retry`,
      retryJobResponseSchema,
      { method: 'POST' },
    );
    return response.job;
  }

  async listOutbox(
    input: Partial<OutboxQuery> = {},
  ): Promise<{ items: OutboxEvent[]; meta: PaginationMeta }> {
    const query = outboxQuerySchema.parse(input);
    return this.request(`/api/outbox?${this.queryString(query)}`, outboxListResponseSchema);
  }

  async retryOutboxEvent(id: string): Promise<OutboxEvent> {
    const responseSchema = z.object({ event: outboxEventSchema });
    const response = await this.request(
      `/api/outbox/${encodeURIComponent(id)}/retry`,
      responseSchema,
      { method: 'POST' },
    );
    return response.event;
  }

  async listMailDeliveries(
    input: Partial<MailDeliveryQuery> = {},
  ): Promise<{ items: MailDelivery[]; meta: PaginationMeta }> {
    const query = mailDeliveryQuerySchema.parse(input);
    return this.request(
      `/api/mail/deliveries?${this.queryString(query)}`,
      mailDeliveryListResponseSchema,
    );
  }

  async sendTestMail(to: string): Promise<MailDelivery> {
    const input = sendTestMailRequestSchema.parse({ to });
    const response = await this.request('/api/mail/test', queuedMailResponseSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.delivery;
  }

  async listNotifications(
    input: Partial<NotificationQuery> = {},
  ): Promise<{ items: Notification[]; meta: PaginationMeta }> {
    const query = notificationQuerySchema.parse(input);
    return this.request(
      `/api/notifications?${this.queryString(query)}`,
      notificationListResponseSchema,
    );
  }

  async unreadNotificationCount(): Promise<number> {
    const response = await this.request(
      '/api/notifications/unread-count',
      unreadNotificationCountSchema,
    );
    return response.count;
  }

  async markNotificationRead(id: string): Promise<Notification> {
    return this.request(`/api/notifications/${encodeURIComponent(id)}/read`, notificationSchema, {
      method: 'POST',
    });
  }

  async archiveNotification(id: string): Promise<Notification> {
    return this.request(
      `/api/notifications/${encodeURIComponent(id)}/archive`,
      notificationSchema,
      { method: 'POST' },
    );
  }

  async createAnnouncement(input: CreateAnnouncementRequest) {
    const request = createAnnouncementRequestSchema.parse(input);
    return this.request(
      '/api/notifications/announcements',
      z.object({ id: z.uuid() }).passthrough(),
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
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

  private queryString(query: Record<string, unknown>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    return search.toString();
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

export function useSettings(): UseQueryResult<SettingView[]> {
  const api = useApiClient();
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.listSettings() });
}

export function useSaveSetting() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: SaveSettingRequest }) =>
      api.saveSetting(key, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useClearSetting() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input = {} }: { key: string; input?: ClearSettingRequest }) =>
      api.clearSetting(key, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useTestSetting() {
  const api = useApiClient();
  return useMutation({ mutationFn: (key: string) => api.testSetting(key) });
}

export function useRotateSettingSecrets() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.rotateSettingSecrets(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useAuditLogs(input: Partial<AuditQuery> = {}) {
  const api = useApiClient();
  const query = auditQuerySchema.parse(input);
  return useQuery({ queryKey: queryKeys.audit(query), queryFn: () => api.listAuditLogs(query) });
}

export function useJobs(input: Partial<JobQuery> = {}) {
  const api = useApiClient();
  const query = jobQuerySchema.parse(input);
  return useQuery({ queryKey: queryKeys.jobs(query), queryFn: () => api.listJobs(query) });
}

export function useRetryJob() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useOutbox(input: Partial<OutboxQuery> = {}) {
  const api = useApiClient();
  const query = outboxQuerySchema.parse(input);
  return useQuery({ queryKey: queryKeys.outbox(query), queryFn: () => api.listOutbox(query) });
}

export function useRetryOutboxEvent() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retryOutboxEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outbox'] }),
  });
}

export function useMailDeliveries(input: Partial<MailDeliveryQuery> = {}) {
  const api = useApiClient();
  const query = mailDeliveryQuerySchema.parse(input);
  return useQuery({
    queryKey: queryKeys.mail(query),
    queryFn: () => api.listMailDeliveries(query),
  });
}

export function useSendTestMail() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to: string) => api.sendTestMail(to),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mail'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useNotifications(input: Partial<NotificationQuery> = {}) {
  const api = useApiClient();
  const query = notificationQuerySchema.parse(input);
  return useQuery({
    queryKey: queryKeys.notifications(query),
    queryFn: () => api.listNotifications(query),
  });
}

export function useUnreadNotificationCount() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: () => api.unreadNotificationCount(),
  });
}

export function useMarkNotificationRead() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useArchiveNotification() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useCreateAnnouncement() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementRequest) => api.createAnnouncement(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['outbox'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
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
