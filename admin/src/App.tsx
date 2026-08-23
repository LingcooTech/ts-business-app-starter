import { Route, Routes } from 'react-router-dom';

import { AdminLayout } from './app/admin-layout';
import { RequirePermission, RequireSession } from './app/guards';
import { NotFoundPage } from './app/not-found-page';
import { AccessPage } from './features/access/page';
import { AccountPage } from './features/account/page';
import { ForgotPasswordPage, LoginPage } from './features/auth/pages';
import { DashboardPage } from './features/dashboard/page';
import { FoundationPage } from './features/foundation/page';
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
          <Route path="foundation" element={<FoundationPage />} />
          <Route path="ui" element={<UiPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
