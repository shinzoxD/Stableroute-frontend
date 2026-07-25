'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiGet, apiPost } from '@/lib/apiClient';
import { isRouterStatus } from '@/lib/validate';

/**
 * Admin operator controls for router pause / unpause.
 *
 * Safety policy:
 * - **Pause** is gated behind a `ConfirmDialog` so a single misclick cannot
 *   stop routing. The POST to `/api/v1/admin/pause` only fires after the
 *   operator confirms; cancel closes the dialog with zero network calls.
 * - **Unpause** runs immediately (no confirm). Restoring traffic is the
 *   recovery action and should not be delayed by an extra modal step.
 *
 * Status is rendered with `Badge` (`ok` = Live, `warning` = Paused). The toggle
 * is disabled with `aria-busy` while a pause/unpause request is in flight, and
 * status is reloaded from `GET /api/v1/admin/status` after a successful toggle.
 * Failures surface in a `role="alert"` region.
 */
export default function AdminClient() {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True while a pause/unpause POST (and status reload) is in flight. */
  const [busy, setBusy] = useState(false);
  /**
   * Whether the pause confirmation dialog is open.
   * Only used for live → pause; unpause never opens this dialog.
   */
  const [confirmPause, setConfirmPause] = useState(false);

  const load = () =>
    apiGet<{ paused: boolean }>('/api/v1/admin/status', {
      validate: isRouterStatus,
    })
      .then((body) => setPaused(body.paused))
      .catch((err) => setError((err as Error).message));

  useEffect(() => {
    load();
  }, []);

  /**
   * POST pause or unpause based on the current status, then reload status.
   * Guards against double-submit while `busy` is true.
   */
  const applyToggle = async () => {
    if (busy || paused === null) return;
    setError(null);
    setBusy(true);
    try {
      await apiPost(
        paused ? '/api/v1/admin/unpause' : '/api/v1/admin/pause',
        {}
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Toggle click handler: open confirm for pause; unpause immediately.
   * See component JSDoc for the operator-safety policy.
   */
  const onToggleClick = () => {
    if (busy || paused === null) return;
    if (paused) {
      void applyToggle();
      return;
    }
    setConfirmPause(true);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col gap-6 p-8 focus:outline-none"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      {paused === null && !error && <p>Loading status…</p>}
      {paused !== null && (
        <section
          aria-labelledby="admin-status-heading"
          className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <h2 id="admin-status-heading" className="sr-only">
            Router pause status
          </h2>
          <div className="flex items-center gap-2">
            <p>Status:</p>
            <Badge variant={paused ? 'warning' : 'ok'}>
              {paused ? 'Paused' : 'Live'}
            </Badge>
          </div>
          <Button
            type="button"
            onClick={onToggleClick}
            disabled={busy}
            aria-pressed={paused}
            aria-busy={busy}
          >
            {busy ? 'Updating…' : paused ? 'Unpause' : 'Pause'}
          </Button>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmPause}
        tone="danger"
        title="Pause routing?"
        description="This stops the router from serving new routes until you unpause. Confirm only if you intend to halt routing."
        confirmLabel="Pause router"
        onConfirm={() => {
          setConfirmPause(false);
          void applyToggle();
        }}
        onCancel={() => setConfirmPause(false)}
      />
    </main>
  );
}
