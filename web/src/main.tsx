import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from './lib/query-client';
import { configureApiClient } from './api-client';
import { router } from './routes/router';
import { ErrorBoundary } from './components/error-boundary';
import { useThemeStore } from './stores/theme-store';
import './i18n';
import './index.css';

configureApiClient();

// Apply persisted theme before first render to avoid flash
document.documentElement.classList.toggle('dark', useThemeStore.getState().dark);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);
