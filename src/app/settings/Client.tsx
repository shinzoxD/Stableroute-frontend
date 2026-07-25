'use client';

import { Card } from '@/components/Card';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  readTheme,
  effectiveTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from '@/lib/theme';
import { getApiBase } from '@/lib/config';
import { useApi } from '@/lib/useApi';
import { useEffect, useState } from 'react';
import { isRouterStatus } from '@/lib/validate';

/**
 * Read-only row showing the public StableRoute API base operators are talking to.
 * Uses {@link getApiBase} so only the non-secret `NEXT_PUBLIC_*` origin is shown.
 */
function ApiBaseRow() {
  return (
    <Card title="API Base">
      <p
        data-testid="api-base-value"
        className="font-mono text-sm text-neutral-600 dark:text-neutral-400"
      >
        {getApiBase()}
      </p>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
        From <code>NEXT_PUBLIC_STABLEROUTE_API_BASE</code> (public origin only —
        no credentials are displayed).
      </p>
    </Card>
  );
}

type RouterStatus = { paused: boolean };

/** Live router pause/resume status with a manual refresh control. */
function RouterStatusRow() {
  const status = useApi<RouterStatus>('/api/v1/admin/status', isRouterStatus);

  return (
    <Card title="Router status">
      <div className="flex items-center justify-between gap-3">
        {status.status === 'loading' && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Loading…
          </p>
        )}
        {status.status === 'error' && (
          <p role="alert" className="text-sm text-rose-600">
            {status.error}
          </p>
        )}
        {status.status === 'success' && (
          <p className="text-sm">
            Router is <strong>{status.data.paused ? 'Paused' : 'Live'}</strong>
          </p>
        )}
        <button
          type="button"
          onClick={status.refetch}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-neutral-700"
        >
          Refresh
        </button>
      </div>
    </Card>
  );
}

/**
 * Sample surface that mirrors the resolved light/dark theme so operators can
 * confirm the effect of the ThemeToggle without leaving Settings.
 *
 * Syncs on mount, on same-tab {@link THEME_CHANGE_EVENT}, and on cross-tab
 * `storage` events.
 */
function AppearancePreview() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
    };
  }, []);

  const resolved = effectiveTheme(theme);
  const bg = resolved === 'dark' ? 'bg-neutral-800' : 'bg-white';
  const text = resolved === 'dark' ? 'text-neutral-100' : 'text-neutral-900';
  const muted = resolved === 'dark' ? 'text-neutral-400' : 'text-neutral-500';
  const border =
    resolved === 'dark' ? 'border-neutral-700' : 'border-neutral-200';

  return (
    <Card title="Appearance Preview">
      <div
        data-testid="appearance-preview"
        data-theme-preference={theme}
        data-resolved-theme={resolved}
        className={`rounded-md border ${border} ${bg} ${text} p-4 transition-colors`}
      >
        <p className="text-sm font-medium">Sample Text</p>
        <p className={`mt-1 text-xs ${muted}`}>
          This is how content appears in the current theme (
          <span data-testid="appearance-preview-preference">{theme}</span>
          {theme === 'system' ? (
            <>
              {' '}
              → <span data-testid="appearance-preview-resolved">{resolved}</span>
            </>
          ) : null}
          ).
        </p>
        <div className="mt-3 flex gap-2">
          <span className="inline-flex h-5 w-5 rounded-full bg-blue-500" />
          <span className="inline-flex h-5 w-5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>
      </div>
    </Card>
  );
}

/** Interactive Settings surface: theme select, live preview, API base, router status. */
export default function SettingsClient() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col gap-8 p-8 focus:outline-none"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="text-lg font-medium">Appearance</legend>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Choose a colour scheme. System follows your OS preference.
        </p>
        <ThemeToggle />
      </fieldset>
      <AppearancePreview />
      <RouterStatusRow />
      <ApiBaseRow />
    </main>
  );
}
