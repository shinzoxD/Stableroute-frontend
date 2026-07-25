import { render, screen, within } from '@testing-library/react';
import { DISCORD_INVITE_URL, Footer } from '../Footer';

describe('Footer', () => {
  it('renders the tagline with the current copyright year', () => {
    render(<Footer />);

    expect(
      screen.getByText('StableRoute — liquidity routing on Stellar.')
    ).toBeInTheDocument();

    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${year} StableRoute\\. All rights reserved\\.`))
    ).toBeInTheDocument();
  });

  it('computes the year dynamically rather than hard-coding it', () => {
    const getFullYearSpy = jest
      .spyOn(Date.prototype, 'getFullYear')
      .mockReturnValue(2031);

    try {
      render(<Footer />);
      expect(
        screen.getByText(/© 2031 StableRoute\. All rights reserved\./)
      ).toBeInTheDocument();
    } finally {
      getFullYearSpy.mockRestore();
    }
  });

  it('exposes a footer navigation landmark with Docs, About, and Discord', () => {
    render(<Footer />);

    const nav = screen.getByRole('navigation', { name: 'Footer navigation' });
    expect(nav).toBeInTheDocument();

    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      '/docs'
    );
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/about'
    );
    expect(
      within(nav).getByRole('link', {
        name: 'StableRoute Discord (opens externally)',
      })
    ).toBeInTheDocument();
  });

  it('links to docs, about, and the external Discord community', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      '/docs'
    );
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '/about'
    );

    const discordLink = screen.getByRole('link', {
      name: 'StableRoute Discord (opens externally)',
    });
    expect(discordLink).toHaveAttribute('href', DISCORD_INVITE_URL);
    expect(discordLink).toHaveAttribute('href', 'https://discord.gg/37aCpusvx');
    expect(discordLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(discordLink).toHaveAttribute('target', '_blank');
  });

  it('applies focus-visible ring styling to footer links', () => {
    render(<Footer />);

    const docs = screen.getByRole('link', { name: 'Docs' });
    const about = screen.getByRole('link', { name: 'About' });
    const discord = screen.getByRole('link', {
      name: 'StableRoute Discord (opens externally)',
    });

    for (const link of [docs, about, discord]) {
      expect(link.className).toMatch(/focus-visible:outline/);
      expect(link.className).toMatch(/focus-visible:outline-2/);
    }
  });

  it('renders as a contentinfo landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
