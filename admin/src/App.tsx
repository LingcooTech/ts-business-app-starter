import { Route, Routes } from 'react-router-dom';

import { AdminLayout } from './app/admin-layout';
import { RequirePermission, RequireSession } from './app/guards';
import { NotFoundPage } from './app/not-found-page';
import { AccessPage } from './features/access/page';
import { AuditPage } from './features/audit/page';
import { AccountPage } from './features/account/page';
import { ForgotPasswordPage, LoginPage } from './features/auth/pages';
import { DashboardPage } from './features/dashboard/page';
import { FoundationPage } from './features/foundation/page';
import { SettingsPage } from './features/settings/page';
import { StoragePage } from './features/storage/page';
import { JobsPage } from './features/jobs/page';
import { MailPage } from './features/mail/page';
import { NotificationsPage } from './features/notifications/page';
import { UiPage } from './features/ui-showcase/page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireSession />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route element={<RequirePermission permission="roles.read" />}>
            <Route path="access" element={<AccessPage />} />
          </Route>
          <Route element={<RequirePermission permission="settings.read" />}>
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<RequirePermission permission="audit.read" />}>
            <Route path="audit" element={<AuditPage />} />
          </Route>
          <Route element={<RequirePermission permission="jobs.read" />}>
            <Route path="jobs" element={<JobsPage />} />
          </Route>
          <Route element={<RequirePermission permission="integrations.manage" />}>
            <Route path="mail" element={<MailPage />} />
          </Route>
          <Route element={<RequirePermission permission="storage.read" />}>
            <Route path="storage" element={<StoragePage />} />
          </Route>
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="foundation" element={<FoundationPage />} />
          <Route path="ui" element={<UiPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
