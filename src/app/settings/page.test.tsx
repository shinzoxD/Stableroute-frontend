/**
 * Tests for the Settings page appearance and API configuration controls.
 *
 * Coverage targets:
 *  - Theme selection writes the documented storage key ("stableroute.theme")
 *  - Resolved API base from src/lib/config.ts is displayed
 *  - AppearancePreview region updates its data-resolved-theme when the
 *    theme is selected (same-tab live update) or via a storage event
 *  - Appearance controls are grouped in a labelled fieldset
 *  - Edge cases: default base, custom env base, unknown storage, secrets not shown
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SettingsPage from './page';
import { DEFAULT_API_BASE } from '@/lib/config';

const mockRefetch = jest.fn();

jest.mock('@/lib/useApi', () => ({
  useApi: jest.fn(() => ({
    status: 'success' as const,
    data: { paused: false },
    refetch: mockRefetch,
  })),
}));

// ---------------------------------------------------------------------------
// Global test-environment setup
// ---------------------------------------------------------------------------

/** Stub matchMedia so effectiveTheme("system") resolves to "light" by default. */
function stubMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

beforeEach(() => {
  stubMatchMedia();
  window.localStorage.clear();
  // Reset env to default between tests
  delete process.env.NEXT_PUBLIC_STABLEROUTE_API_BASE;
});

// ---------------------------------------------------------------------------
// Existing smoke tests (kept for non-regression)
// ---------------------------------------------------------------------------

describe('SettingsPage — smoke', () => {
  it('renders the Settings heading', () => {
    render(<SettingsPage />);
    expect(
      screen.getByRole('heading', { name: /settings/i })
    ).toBeInTheDocument();
  });

  it('keeps the main skip target with focus outline suppressed', () => {
    render(<SettingsPage />);
    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute('tabIndex', '-1');
    expect(main?.className).toMatch(/focus:outline-none/);
  });

  it('renders all three ThemeToggle buttons', () => {
    render(<SettingsPage />);
    expect(
      screen.getByRole('button', { name: /^light$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^system$/i })
    ).toBeInTheDocument();
  });

  it('renders the appearance preview section', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/appearance preview/i)).toBeInTheDocument();
    expect(screen.getByText(/sample text/i)).toBeInTheDocument();
  });

  it('renders the API base card heading', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/api base/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Appearance controls grouping (fieldset / legend)
// ---------------------------------------------------------------------------

describe('SettingsPage — appearance controls grouping', () => {
  it('groups Appearance controls in a labelled fieldset', () => {
    render(<SettingsPage />);

    const group = screen.getByRole('group', { name: /^appearance$/i });
    expect(group.tagName.toLowerCase()).toBe('fieldset');
    expect(group).toContainElement(
      screen.getByRole('button', { name: /^light$/i })
    );
    expect(group).toContainElement(
      screen.getByRole('button', { name: /^dark$/i })
    );
    expect(group).toContainElement(
      screen.getByRole('button', { name: /^system$/i })
    );
    expect(group).toContainElement(
      screen.getByText(/choose a colour scheme/i)
    );
  });

  it('exposes the group name through a visible legend', () => {
    render(<SettingsPage />);

    const legend = document.querySelector('fieldset > legend');
    expect(legend).toHaveTextContent('Appearance');
    expect(legend).not.toHaveClass('sr-only');
  });

  it('does not change the theme-selection behaviour from inside the fieldset', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));

    expect(window.localStorage.getItem('stableroute.theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /^dark$/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('keeps the nested Theme button group nested inside the Appearance fieldset', () => {
    render(<SettingsPage />);

    const fieldset = screen.getByRole('group', { name: /^appearance$/i });
    const themeGroup = screen.getByRole('group', { name: /^theme$/i });
    expect(fieldset).toContainElement(themeGroup);
  });
});

// ---------------------------------------------------------------------------
// Theme selection → localStorage write
// ---------------------------------------------------------------------------

describe('SettingsPage — theme selection writes localStorage', () => {
  const STORAGE_KEY = 'stableroute.theme';

  it("clicking Light writes 'light' under the documented storage key", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it("clicking Dark writes 'dark' under the documented storage key", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it("clicking System writes 'system' under the documented storage key", () => {
    render(<SettingsPage />);
    // First set something else so the system click is a genuine change
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^system$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('system');
  });

  it('does NOT write to any other storage key', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    // Only the documented key should exist
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe(STORAGE_KEY);
  });

  it('overwriting the theme with a new selection updates the stored value', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('aria-pressed reflects the active selection', () => {
    render(<SettingsPage />);
    const lightBtn = screen.getByRole('button', { name: /^light$/i });
    const darkBtn = screen.getByRole('button', { name: /^dark$/i });

    fireEvent.click(lightBtn);
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true');
    expect(darkBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(darkBtn);
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true');
    expect(lightBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// API base display
// ---------------------------------------------------------------------------

describe('SettingsPage — API base display', () => {
  it('shows the default API base when no env var is set', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('api-base-value')).toHaveTextContent(
      DEFAULT_API_BASE
    );
  });

  it('shows the env-override URL when NEXT_PUBLIC_STABLEROUTE_API_BASE is set', () => {
    process.env.NEXT_PUBLIC_STABLEROUTE_API_BASE =
      'https://api.staging.example.test';
    render(<SettingsPage />);
    expect(screen.getByTestId('api-base-value')).toHaveTextContent(
      'https://api.staging.example.test'
    );
  });

  it('strips a trailing slash from the displayed URL', () => {
    process.env.NEXT_PUBLIC_STABLEROUTE_API_BASE = 'https://api.example.test/';
    render(<SettingsPage />);
    expect(screen.getByTestId('api-base-value')).toHaveTextContent(
      'https://api.example.test'
    );
    expect(screen.getByTestId('api-base-value').textContent).not.toMatch(/\/$/);
  });

  it('renders the API base value in a monospace element', () => {
    render(<SettingsPage />);
    const el = screen.getByTestId('api-base-value');
    expect(el.tagName.toLowerCase()).toBe('p');
    expect(el.className).toMatch(/font-mono/);
  });

  it('does not render secret API credentials on the page', () => {
    process.env.STABLEROUTE_API_KEY = 'sk-super-secret-credential';
    process.env.API_SECRET = 'another-secret-value';
    render(<SettingsPage />);
    expect(
      screen.queryByText(/sk-super-secret-credential/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/another-secret-value/)).not.toBeInTheDocument();
    // Public base remains the only config value shown.
    expect(screen.getByTestId('api-base-value')).toHaveTextContent(
      DEFAULT_API_BASE
    );
    delete process.env.STABLEROUTE_API_KEY;
    delete process.env.API_SECRET;
  });
});

// ---------------------------------------------------------------------------
// AppearancePreview — updates with theme selection
// ---------------------------------------------------------------------------

describe('SettingsPage — AppearancePreview updates with theme', () => {
  it("resolves to 'light' by default when matchMedia returns false", () => {
    stubMatchMedia(false);
    render(<SettingsPage />);
    const preview = screen.getByTestId('appearance-preview');
    expect(preview).toHaveAttribute('data-resolved-theme', 'light');
  });

  it("resolves to 'dark' live when the dark button is clicked (same tab)", async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'dark'
      )
    );
    expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
      'data-theme-preference',
      'dark'
    );
  });

  it("resolves to 'light' live when the light button is clicked (same tab)", async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'dark'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'light'
      )
    );
  });

  it("resolves to 'dark' for system theme when OS prefers dark", async () => {
    stubMatchMedia(true); // simulate prefers-color-scheme: dark
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^system$/i }));
    // system → effectiveTheme reads matchMedia → "dark"
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'dark'
      )
    );
  });

  it("resolves to 'light' for system theme when OS prefers light", async () => {
    stubMatchMedia(false);
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^system$/i }));
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'light'
      )
    );
  });

  it('preview updates when a storage event fires with a new theme', async () => {
    render(<SettingsPage />);
    // Simulate another tab writing 'dark' to localStorage and firing the event
    window.localStorage.setItem('stableroute.theme', 'dark');
    act(() => {
      window.dispatchEvent(new Event('storage'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'dark'
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SettingsPage — edge cases', () => {
  it('falls back to system when localStorage contains an unknown theme value', async () => {
    stubMatchMedia(false); // system → light
    window.localStorage.setItem('stableroute.theme', 'sepia'); // invalid value
    render(<SettingsPage />);
    // readTheme returns "system" for unknown values → resolves to "light"
    await waitFor(() =>
      expect(screen.getByTestId('appearance-preview')).toHaveAttribute(
        'data-resolved-theme',
        'light'
      )
    );
  });

  it('still renders when localStorage is unavailable', () => {
    // Simulate a storage-access error (e.g. third-party cookie blocking)
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('storage blocked');
    };

    expect(() => render(<SettingsPage />)).not.toThrow();

    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
  });

  it('shows router live status and invokes refetch on Refresh', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/router is/i)).toBeInTheDocument();
    expect(screen.getByText(/live/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
