'use client';

import { useCallback, useRef, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconButton } from '@/components/IconButton';
import { ResourceList } from '@/components/ResourceList';
import { TextField } from '@/components/TextField';
import { TimeAgo } from '@/components/TimeAgo';
import { apiDelete, apiGet, apiPost } from '@/lib/apiClient';
import type { Webhook } from '@/lib/types';
import { useList } from '@/lib/useList';
import { isWebhookListResponse } from '@/lib/validate';
import { WEBHOOK_EVENT_OPTIONS } from '@/lib/webhookEvents';

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export default function WebhooksClient() {
  const loadHooks = useCallback(
    () =>
      apiGet<{ items: Webhook[] }>('/api/v1/webhooks', {
        validate: isWebhookListResponse,
      }).then((body) => body.items),
    []
  );
  const hooks = useList(loadHooks);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'pair.registered',
  ]);
  /** True while register POST (and the following list refetch) is in flight. */
  const [submitting, setSubmitting] = useState(false);
  /** Synchronous guard so rapid double-submit cannot race past React state. */
  const submittingRef = useRef(false);
  const [confirmRegister, setConfirmRegister] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const items = hooks.status === 'success' ? hooks.data : null;
  const loading = hooks.status === 'idle' || hooks.status === 'loading';
  const displayError =
    localError ?? (hooks.status === 'error' ? hooks.error : null);

  const toggleEvent = (event: string) => {
    setSelectedEvents((current) =>
      current.includes(event)
        ? current.filter((entry) => entry !== event)
        : [...current, event]
    );
  };

  /**
   * Register a webhook for the current URL and selected events.
   * Guards against double-submit while a request is already in flight; the
   * submit control is disabled and shows "Registering…" until the try/finally
   * clears `submitting` on both success and failure.
   */
  const registerWebhook = async () => {
    if (submittingRef.current) return;
    if (!isHttpsUrl(url)) {
      setLocalError('Webhook URL must use HTTPS.');
      return;
    }
    if (selectedEvents.length === 0) {
      setLocalError('Select at least one event.');
      return;
    }
    setLocalError(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await apiPost('/api/v1/webhooks', { url, events: selectedEvents });
      setUrl('');
      await hooks.refetch();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[60vh] max-w-3xl flex-col gap-6 p-8"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Webhooks</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmRegister(true);
        }}
        className="flex flex-col gap-3"
      >
        <TextField
          label="URL"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <fieldset>
          <legend className="text-sm font-medium">Events</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEBHOOK_EVENT_OPTIONS.map((event) => (
              <label key={event} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                />
                {event}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="self-start"
        >
          {submitting ? 'Registering…' : 'Register'}
        </Button>
        {displayError && (
          <p role="alert" className="text-sm text-rose-600">
            {displayError}
          </p>
        )}
      </form>
      <ResourceList
        items={items}
        loading={loading}
        emptyMessage="No webhooks registered."
        getKey={(hook) => hook.id}
        caption="Registered webhooks"
        tableHeaders={['URL', 'Events', 'Registered', 'Actions']}
        renderRow={(hook, { requestRemove }) => (
          <>
            <div>
              <p className="break-all text-sm font-medium">{hook.url}</p>
              <p className="text-xs text-neutral-500">
                Registered <TimeAgo ts={hook.createdAt} />
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {hook.events.map((event) => (
                  <Badge key={event}>{event}</Badge>
                ))}
              </div>
            </div>
            <IconButton label="Remove webhook" onClick={requestRemove}>
              ×
            </IconButton>
          </>
        )}
        renderCells={(hook, { requestRemove }) => [
          <span key="url" className="break-all text-sm font-medium">
            {hook.url}
          </span>,
          <div key="events" className="flex flex-wrap gap-1">
            {hook.events.map((event) => (
              <Badge key={event}>{event}</Badge>
            ))}
          </div>,
          <span key="registered" className="text-xs text-neutral-500">
            <TimeAgo ts={hook.createdAt} />
          </span>,
          <IconButton
            key="actions"
            label="Remove webhook"
            onClick={requestRemove}
          >
            ×
          </IconButton>,
        ]}
        removeDialogTitle="Remove webhook?"
        removeDialogConfirmLabel="Remove"
        onRemove={(hook) =>
          void apiDelete(`/api/v1/webhooks/${hook.id}`).then(() =>
            hooks.refetch()
          )
        }
      />
      <ConfirmDialog
        open={confirmRegister}
        tone="default"
        title="Register webhook?"
        onConfirm={() => {
          setConfirmRegister(false);
          void registerWebhook();
        }}
        onCancel={() => setConfirmRegister(false)}
      />
    </main>
  );
}
