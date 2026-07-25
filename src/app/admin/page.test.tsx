import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from './page';

const mockFetch = (data: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response);
};

/** Count fetch calls whose URL includes the given path fragment. */
const countFetchFor = (fetchMock: jest.Mock, path: string) =>
  fetchMock.mock.calls.filter((call) => String(call[0]).includes(path)).length;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AdminPage semantics', () => {
  it('exposes one main landmark and one page heading', async () => {
    mockFetch({ paused: false });
    render(<AdminPage />);

    expect(document.querySelectorAll('#main-content')).toHaveLength(1);
    expect(
      screen.getAllByRole('heading', { level: 1, name: /admin/i })
    ).toHaveLength(1);
    await screen.findByText('Live');
  });

  it('names the pause status panel with an accessible region', async () => {
    mockFetch({ paused: true });
    render(<AdminPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /router pause status/i })
      ).toBeInTheDocument();
    });
  });

  it('reflects paused state with aria-pressed on the toggle', async () => {
    mockFetch({ paused: true });
    render(<AdminPage />);

    const toggle = await screen.findByRole('button', { name: /unpause/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('reflects live state with aria-pressed false', async () => {
    mockFetch({ paused: false });
    render(<AdminPage />);

    const toggle = await screen.findByRole('button', { name: /^pause$/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AdminPage status badge', () => {
  it('renders a Live badge with the ok variant when the router is live', async () => {
    mockFetch({ paused: false });
    render(<AdminPage />);

    const badge = await screen.findByText('Live');
    expect(badge.closest('[data-badge]')).toHaveAttribute('data-variant', 'ok');
  });

  it('renders a Paused badge with the warning variant when the router is paused', async () => {
    mockFetch({ paused: true });
    render(<AdminPage />);

    const badge = await screen.findByText('Paused');
    expect(badge.closest('[data-badge]')).toHaveAttribute(
      'data-variant',
      'warning'
    );
  });
});

describe('AdminPage pause confirmation', () => {
  it('does not POST pause until the confirm dialog is accepted', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: false })),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: true })),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<AdminPage />);
    const toggle = await screen.findByRole('button', { name: /^pause$/i });

    fireEvent.click(toggle);

    // Dialog is open; only the initial status GET has run.
    expect(
      await screen.findByRole('dialog', { name: /pause routing/i })
    ).toBeInTheDocument();
    expect(countFetchFor(fetchMock, '/api/v1/admin/pause')).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /pause router/i }));

    await waitFor(() => {
      expect(countFetchFor(fetchMock, '/api/v1/admin/pause')).toBe(1);
    });
  });

  it('cancel closes the dialog and performs zero additional network calls', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ paused: false })),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<AdminPage />);
    await screen.findByRole('button', { name: /^pause$/i });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }));
    await screen.findByRole('dialog', { name: /pause routing/i });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Still only the initial GET — no pause POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(countFetchFor(fetchMock, '/api/v1/admin/pause')).toBe(0);
  });

  it('reloads status after a confirmed pause', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: false })),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: true })),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<AdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: /^pause$/i }));
    fireEvent.click(screen.getByRole('button', { name: /pause router/i }));

    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
    expect(countFetchFor(fetchMock, '/api/v1/admin/status')).toBeGreaterThanOrEqual(
      2
    );
  });
});

describe('AdminPage unpause policy', () => {
  it('unpauses immediately without opening a confirm dialog', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: true })),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}'),
      } as unknown as Response)
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: false })),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<AdminPage />);
    const toggle = await screen.findByRole('button', { name: /unpause/i });
    fireEvent.click(toggle);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(countFetchFor(fetchMock, '/api/v1/admin/unpause')).toBe(1);
    });
    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });
});

describe('AdminPage in-flight and error states', () => {
  it('marks the toggle busy and disabled while the request is in flight', async () => {
    let resolvePost: (() => void) | undefined;
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: false })),
      } as unknown as Response)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePost = () =>
              resolve({
                ok: true,
                text: () => Promise.resolve('{}'),
              } as unknown as Response);
          })
      )
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: true })),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<AdminPage />);
    const toggle = await screen.findByRole('button', { name: /^pause$/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /pause router/i }));

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-busy', 'true');
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveTextContent(/updating/i);
    });

    resolvePost?.();
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-busy', 'false');
      expect(toggle).not.toBeDisabled();
    });
  });

  it('re-enables the toggle after a failed request and shows the error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ paused: false })),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: () =>
          Promise.resolve(
            JSON.stringify({ error: 'server_error', message: 'Pause failed' })
          ),
      } as unknown as Response) as unknown as typeof global.fetch;

    render(<AdminPage />);
    const toggle = await screen.findByRole('button', { name: /^pause$/i });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /pause router/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Pause failed/i);
    expect(toggle).toHaveAttribute('aria-busy', 'false');
    expect(toggle).not.toBeDisabled();
  });
});
