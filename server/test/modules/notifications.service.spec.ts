import { describe, expect, it, vi } from 'vitest';

import type { Database, DatabaseTransaction } from '../../src/common/database/database.port';
import type { AuditService } from '../../src/modules/audit/public';
import { NotificationsService } from '../../src/modules/notifications/application/notifications.service';
import type { NotificationsRepository } from '../../src/modules/notifications/infrastructure/persistence/notifications.repository';
import type { OutboxService } from '../../src/modules/outbox/public';

describe('NotificationsService', () => {
  it('persists an announcement and its outbox event atomically', async () => {
    const transaction = {} as DatabaseTransaction;
    const database = {
      transaction: vi.fn(async (operation: (executor: DatabaseTransaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as Database;
    const eventId = '5a3868bb-ce8d-499e-a09f-397a106104ce';
    const outbox = {
      append: vi.fn().mockResolvedValue({ id: eventId }),
    } as unknown as OutboxService;
    const repository = {
      createAnnouncement: vi
        .fn()
        .mockImplementation(async (id: string) => ({ id, outboxEventId: eventId })),
    } as unknown as NotificationsRepository;
    const audit = { record: vi.fn().mockResolvedValue({}) } as unknown as AuditService;
    const service = new NotificationsService(database, repository, outbox, audit);
    const input = {
      recipientUserId: '0bba36fe-fdea-4a9b-b29c-85232b42d182',
      category: 'announcement',
      level: 'info' as const,
      title: 'Maintenance',
      body: 'Scheduled maintenance',
      dedupeKey: 'maintenance-1',
    };

    await service.announce(input, {
      actorType: 'user',
      actorId: '182e1206-b06f-43bb-9501-20b218df00b7',
    });

    expect(vi.mocked(outbox.append).mock.calls[0]?.[1]).toBe(transaction);
    expect(vi.mocked(repository.createAnnouncement).mock.calls[0]?.[4]).toBe(transaction);
    expect(vi.mocked(audit.record).mock.calls[0]?.[1]).toBe(transaction);
    expect(outbox.append).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'notifications.create',
        dedupeKey: 'notification-announcement:maintenance-1',
      }),
      transaction,
    );
  });
});
