/**
 * Tests for the /api-keys page: list, create (one-time secret), and revoke.
 *
 * The client loads keys via `apiGet`, creates via `apiPost` (which returns the
 * full secret once), and revokes via `apiDelete` by prefix. These tests mock
 * the apiClient helpers so the credential surface can be verified without a
 * live backend.
 */
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import ApiKeysPage, { metadata } from './page';
import { ToastProvider } from '@/components/ToastProvider';
import { apiDelete, apiGet, apiPost } from '@/lib/apiClient';
import type { ApiKey, CreateApiKeyResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// apiClient mocks — comments document the contract under test
// ---------------------------------------------------------------------------

/**
 * Mock the shared HTTP helpers used by ApiKeysClient:
 * - apiGet  → GET  /api/v1/api-keys          (list)
 * - apiPost → POST /api/v1/api-keys          (create; returns full secret once)
 * - apiDelete → DELETE /api/v1/api-keys/:prefix (revoke)
 */
jest.mock('@/lib/apiClient', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn(),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const KEY_1: ApiKey = {
  prefix: 'sk_abc',
  label: 'Production',
  createdAt: Date.now() - 86_400_000,
};

const KEY_2: ApiKey = {
  prefix: 'sk_xyz',
  label: 'Staging',
  createdAt: Date.now() - 3_600_000,
};

const CREATED: CreateApiKeyResponse = {
  key: 'sk_live_supersecret_value_shown_once',
  prefix: 'sk_live',
};

function renderPage() {
  return render(
    <ToastProvider>
      <ApiKeysPage />
    </ToastProvider>
  );
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
}

/** Type a label and submit the create form. */
async function submitCreate(label = 'Production operator') {
  fireEvent.change(screen.getByLabelText('Label'), {
    target: { value: label },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
}

/**
 * Default happy-path list response. Callers override per-test as needed.
 * apiGet is invoked once on mount via useList, and again on every refetch
 * after create/revoke.
 */
function mockList(items: ApiKey[] = []) {
  mockApiGet.mockResolvedValue({ items } as never);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

describe('ApiKeysPage', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.clearAllMocks();
    // One-time secret is only rendered in a secure browser context.
    Object.defineProperty(window, 'isSecureContext', {
      writable: true,
      configurable: true,
      value: true,
    });
    mockList([]);
    mockApiPost.mockResolvedValue(CREATED as never);
    mockApiDelete.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    setClipboard(originalClipboard);
  });

  it('exports page metadata for the API keys route', () => {
    expect(metadata.title).toBe('API keys');
    expect(metadata.description).toMatch(/Create, view and revoke API keys/i);
  });

  // -------------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('shows loading before data arrives', () => {
      // apiGet never resolves → useList stays in loading
      mockApiGet.mockReturnValue(new Promise(() => {}) as never);
      renderPage();
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('renders keys from the mocked apiGet response', async () => {
      mockList([KEY_1, KEY_2]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument();
      });
      expect(screen.getByText('Staging')).toBeInTheDocument();
      expect(screen.getByText(/sk_abc/)).toBeInTheDocument();
      expect(screen.getByText(/sk_xyz/)).toBeInTheDocument();

      // List endpoint only — no create/delete side effects on mount.
      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/v1/api-keys',
        expect.objectContaining({ validate: expect.any(Function) })
      );
      expect(mockApiPost).not.toHaveBeenCalled();
      expect(mockApiDelete).not.toHaveBeenCalled();
    });

    it('announces empty state via live region', async () => {
      mockList([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument();
      });
    });

    it('renders api keys in a single polite live region', async () => {
      mockList([KEY_1]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument();
      });
      const live = document.querySelector('[aria-live=polite]');
      expect(live).toBeInTheDocument();
      expect(live).toHaveAttribute('aria-atomic', 'true');
    });

    it('has exactly one aria-live=polite region in the page content', async () => {
      mockList([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument();
      });
      // Scoped to <main>: ToastProvider contributes its own aria-live region
      // outside the page content.
      expect(
        document.querySelectorAll('main [aria-live=polite]')
      ).toHaveLength(1);
    });

    it('renders createdAt timestamps with TimeAgo', async () => {
      const now = Date.now();
      mockList([
        { prefix: 'sk_old', label: 'Old Key', createdAt: now - 86_400_000 },
        { prefix: 'sk_new', label: 'New Key', createdAt: now },
      ]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Old Key')).toBeInTheDocument();
      });

      const timeElements = document.querySelectorAll('time');
      expect(timeElements.length).toBeGreaterThanOrEqual(2);
      timeElements.forEach((time) => {
        expect(time).toHaveAttribute('dateTime');
        expect(time.textContent).toMatch(/(\d+[dhms]\s+ago|just now)/);
      });
    });

    it('has exactly one #main-content landmark', async () => {
      mockList([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument();
      });
      expect(document.querySelectorAll('#main-content')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // CREATE + ONE-TIME SECRET DISPLAY
  // -------------------------------------------------------------------------

  describe('create and one-time secret display', () => {
    it('surfaces the returned secret in role="status" and clears the label', async () => {
      // 1st apiGet: empty list on mount
      // apiPost: create returns full secret
      // 2nd apiGet: refetch after create includes the new key metadata only
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: CREATED.prefix!,
              label: 'Production operator',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(CREATED as never);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument();
      });

      const labelInput = screen.getByLabelText('Label');
      fireEvent.change(labelInput, {
        target: { value: 'Production operator' },
      });
      expect(labelInput).toHaveValue('Production operator');

      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      // Secret appears exactly once inside the one-time status region.
      const status = await screen.findByRole('status');
      expect(status).toHaveTextContent(/Copy now — shown only once/i);
      expect(within(status).getByText(CREATED.key)).toBeInTheDocument();

      // Label field is cleared after a successful create.
      expect(labelInput).toHaveValue('');

      // apiPost payload contract.
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/v1/api-keys',
        { label: 'Production operator' },
        expect.objectContaining({ validate: expect.any(Function) })
      );

      // List reloads after create so the new key row appears (prefix only).
      await waitFor(() => {
        expect(screen.getByText('Production operator')).toBeInTheDocument();
      });
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });

    it('marks the newly created key with a New badge via recent prefix', async () => {
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: 'sk_live',
              label: 'Production operator',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(CREATED as never);

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });

    it('falls back to key.slice(0, 8) when create response omits prefix', async () => {
      const secretOnly: CreateApiKeyResponse = {
        key: 'sk_noprefix_fullsecret',
      };
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: 'sk_nopre',
              label: 'No Prefix',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(secretOnly as never);

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate('No Prefix');

      const status = await screen.findByRole('status');
      expect(within(status).getByText(secretOnly.key)).toBeInTheDocument();
      // Prefix fallback = first 8 chars of the secret.
      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });

    it('does not render the secret outside the one-time status region after display', async () => {
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: CREATED.prefix!,
              label: 'Production operator',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(CREATED as never);

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      const status = await screen.findByRole('status');
      expect(within(status).getByText(CREATED.key)).toBeInTheDocument();

      // Full secret must not leak into list rows — only the prefix is listed.
      await waitFor(() => {
        expect(screen.getByText(/sk_live…/)).toBeInTheDocument();
      });
      const secretMatches = screen.getAllByText(CREATED.key);
      expect(secretMatches).toHaveLength(1);
      expect(status).toContainElement(secretMatches[0]);
    });

    it('hides the secret over insecure contexts and shows a secure-context alert', async () => {
      Object.defineProperty(window, 'isSecureContext', {
        writable: true,
        configurable: true,
        value: false,
      });
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: CREATED.prefix!,
              label: 'Production operator',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(CREATED as never);

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      await waitFor(() => {
        expect(
          screen.getByText(
            /API secrets are only shown over HTTPS in a secure browser context/i
          )
        ).toBeInTheDocument();
      });
      // role="status" one-time block must not appear when insecure.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.queryByText(CREATED.key)
      ).not.toBeInTheDocument();
    });

    it('shows Creating… and disables the button while the request is in flight', async () => {
      let resolvePost!: (v: CreateApiKeyResponse) => void;
      mockApiGet.mockResolvedValue({ items: [] } as never);
      mockApiPost.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePost = resolve;
          }) as never
      );

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /creating/i });
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute('aria-busy', 'true');
      });

      await act(async () => {
        resolvePost(CREATED);
      });
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Create' })
        ).not.toBeDisabled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // REVOKE
  // -------------------------------------------------------------------------

  describe('revoke', () => {
    it('calls apiDelete with the key prefix and reloads the list', async () => {
      mockApiGet
        .mockResolvedValueOnce({ items: [KEY_1] } as never)
        .mockResolvedValueOnce({ items: [] } as never);
      mockApiDelete.mockResolvedValueOnce(undefined as never);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument();
      });

      // Row Revoke opens the shared confirm dialog.
      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(/Revoke API key/i);

      // Confirm with the dialog's Revoke button.
      fireEvent.click(
        within(dialog).getByRole('button', { name: /^Revoke$/i })
      );

      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith(
          `/api/v1/api-keys/${KEY_1.prefix}`
        );
      });

      // List reloads after revoke — empty state returns.
      await waitFor(() => {
        expect(screen.getByText(/No API keys yet/i)).toBeInTheDocument();
      });
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });

    it('does not call apiDelete when the confirm dialog is cancelled', async () => {
      mockList([KEY_1]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockApiDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Production')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // ERRORS
  // -------------------------------------------------------------------------

  describe('error regions', () => {
    it('renders role="alert" when the list request rejects', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Network request failed'));

      renderPage();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Network request failed/i);
      // No secret should ever be present on a failed list load.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Copy now — shown only once/i)
      ).not.toBeInTheDocument();
    });

    it('does not write the secret into status/list state when create rejects', async () => {
      mockList([]);
      mockApiPost.mockRejectedValueOnce(new Error('Server error'));

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));

      const labelInput = screen.getByLabelText('Label');
      fireEvent.change(labelInput, { target: { value: 'Will Fail' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      // Create failure is local: secret must never appear, status region absent.
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Create' })
        ).not.toBeDisabled();
      });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Copy now — shown only once/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/sk_live_supersecret/i)
      ).not.toBeInTheDocument();
      // Label is only cleared on success — retained so the user can retry.
      expect(labelInput).toHaveValue('Will Fail');
      // No list refetch after a failed create.
      expect(mockApiGet).toHaveBeenCalledTimes(1);
    });

    it('re-enables the create button after a failed create', async () => {
      mockList([]);
      mockApiPost.mockRejectedValueOnce(new Error('Server error'));

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: 'Create' });
        expect(btn).not.toBeDisabled();
        expect(btn).toHaveAttribute('aria-busy', 'false');
      });
    });
  });

  // -------------------------------------------------------------------------
  // CLIPBOARD GUARD (one-time secret copy)
  // -------------------------------------------------------------------------

  describe('clipboard guard', () => {
    function mockCreateFlow() {
      mockApiGet
        .mockResolvedValueOnce({ items: [] } as never)
        .mockResolvedValueOnce({
          items: [
            {
              prefix: CREATED.prefix!,
              label: 'Production operator',
              createdAt: Date.now(),
            },
          ],
        } as never);
      mockApiPost.mockResolvedValueOnce(CREATED as never);
    }

    it('copies the secret and hides it once the write succeeds', async () => {
      mockCreateFlow();
      const writeText = jest.fn().mockResolvedValue(undefined);
      setClipboard({ writeText });

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      expect(await screen.findByText(CREATED.key)).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Copy API key secret' })
      );

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(CREATED.key);
      });
      // After a successful copy the one-time secret is cleared from state.
      await waitFor(() => {
        expect(screen.queryByText(CREATED.key)).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows a toast and a selectable fallback field when the write is rejected', async () => {
      mockCreateFlow();
      const writeText = jest
        .fn()
        .mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
      setClipboard({ writeText });

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      expect(await screen.findByText(CREATED.key)).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Copy API key secret' })
      );

      expect(
        await screen.findByText(
          "Couldn't copy automatically. Select and copy the key below."
        )
      ).toBeInTheDocument();

      const fallbackField = await screen.findByLabelText('API key secret');
      expect(fallbackField).toHaveValue(CREATED.key);
      // Secret remains visible for manual copy after a failed write.
      expect(screen.getByText(CREATED.key)).toBeInTheDocument();
      // Focusing the fallback selects the full secret for easy manual copy.
      fireEvent.focus(fallbackField);
      expect((fallbackField as HTMLInputElement).selectionStart).toBe(0);
      expect((fallbackField as HTMLInputElement).selectionEnd).toBe(
        CREATED.key.length
      );
    });

    it('does not attempt a clipboard write when the Clipboard API is unavailable', async () => {
      mockCreateFlow();
      setClipboard(undefined);

      renderPage();
      await waitFor(() => screen.getByText(/No API keys yet/i));
      await submitCreate();

      expect(await screen.findByText(CREATED.key)).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: 'Copy API key secret' })
      );

      expect(
        await screen.findByText(
          "Couldn't copy automatically. Select and copy the key below."
        )
      ).toBeInTheDocument();
      expect(await screen.findByLabelText('API key secret')).toHaveValue(
        CREATED.key
      );
    });
  });
});
