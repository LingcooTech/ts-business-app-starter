import { Route, Routes } from 'react-router-dom';

import { RequireSession } from './app/guards';
import { NotFoundPage } from './app/not-found-page';
import { SiteLayout } from './app/site-layout';
import { AccountPage } from './features/account/page';
import { LoginPage } from './features/auth/login-page';
import { ForgotPasswordPage, ResetPasswordPage } from './features/auth/recovery-pages';
import { VerifyEmailPage } from './features/auth/verify-email-page';
import { HomePage } from './features/home/page';

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route element={<RequireSession />}>
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
