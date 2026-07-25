import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';
import { THEME_KEY } from '@/lib/theme';

const originalLocalStorage = window.localStorage;

function replaceLocalStorage(storage: Partial<Storage>) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

function mockMatchMedia(prefersDark: boolean) {
  // jsdom does not implement matchMedia; ThemeToggle resolves "system"
  // through prefers-color-scheme: dark on mount and after a system click.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
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

describe('ThemeToggle', () => {
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    jest.restoreAllMocks();
  });

  describe('accessible structure', () => {
    it('renders light, dark, and system buttons inside the Theme group', () => {
      render(<ThemeToggle />);
      const group = screen.getByRole('group', { name: 'Theme' });
      expect(within(group).getAllByRole('button')).toHaveLength(3);
      expect(
        within(group).getByRole('button', { name: 'light' })
      ).toBeInTheDocument();
      expect(
        within(group).getByRole('button', { name: 'dark' })
      ).toBeInTheDocument();
      expect(
        within(group).getByRole('button', { name: 'system' })
      ).toBeInTheDocument();
    });
  });

  describe('empty state (no stored value)', () => {
    it('defaults to system when nothing is stored', () => {
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('success state (stored value loaded)', () => {
    it('reads a stored dark theme from localStorage and marks it pressed', () => {
      window.localStorage.setItem(THEME_KEY, 'dark');
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('reads a stored light theme from localStorage', () => {
      window.localStorage.setItem(THEME_KEY, 'light');
      document.documentElement.classList.add('dark');
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('reads a stored system theme from localStorage', () => {
      window.localStorage.setItem(THEME_KEY, 'system');
      mockMatchMedia(true);
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('error / corrupted state', () => {
    it('falls back to system when localStorage.getItem throws', () => {
      replaceLocalStorage({
        getItem: jest.fn(() => {
          throw new Error('storage disabled');
        }),
      });
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('falls back to system when the stored value is invalid', () => {
      window.localStorage.setItem(THEME_KEY, 'midnight');
      render(<ThemeToggle />);
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('still updates the UI when localStorage.setItem throws', () => {
      render(<ThemeToggle />);
      replaceLocalStorage({
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(() => {
          throw new Error('quota exceeded');
        }),
      });

      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
  });

  describe('interactions', () => {
    it('persists dark to localStorage and adds the dark class', () => {
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('persists light, removes the dark class, and marks light pressed', () => {
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'light' }));
      expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('updates aria-pressed when clicking a different theme', () => {
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      fireEvent.click(screen.getByRole('button', { name: 'system' }));
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByRole('button', { name: 'dark' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('resolves system theme via matchMedia for the dark class', () => {
      mockMatchMedia(true);
      render(<ThemeToggle />);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)'
      );
    });

    it('sets the dark class based on effective theme when selecting system', () => {
      mockMatchMedia(true);
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      fireEvent.click(screen.getByRole('button', { name: 'system' }));
      expect(window.localStorage.getItem(THEME_KEY)).toBe('system');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(screen.getByRole('button', { name: 'system' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('removes the dark class when system resolves to light', () => {
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole('button', { name: 'dark' }));
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'system' }));
      expect(window.localStorage.getItem(THEME_KEY)).toBe('system');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('keyboard interaction', () => {
    it('activates a theme button via keyboard Enter', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.tab();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('activates a theme button via keyboard Space', async () => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.tab();
      await user.keyboard(' ');
      expect(screen.getByRole('button', { name: 'light' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
  });

  it('calls onChange with the selected theme', () => {
    render(<ThemeToggle onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('calls onChange for every theme selection', () => {
    render(<ThemeToggle onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'system' }));
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenNthCalledWith(1, 'light');
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark');
    expect(onChange).toHaveBeenNthCalledWith(3, 'system');
  });

  it('does not crash when onChange is omitted', () => {
    expect(() => render(<ThemeToggle />)).not.toThrow();
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
  });
});
