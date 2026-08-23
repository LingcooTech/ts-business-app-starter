import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiClient, ApiProvider } from '@ts-business-app-starter/api-client';
import { AppErrorBoundary, ToastProvider } from '@ts-business-app-starter/ui';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import '@ts-business-app-starter/design-tokens/tokens.css';
import '@ts-business-app-starter/ui/styles.css';
import './styles.css';

const apiClient = new ApiClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ApiProvider client={apiClient}>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ApiProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
