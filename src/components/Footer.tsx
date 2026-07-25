import Link from 'next/link';

const footerLinkClass =
  'rounded px-1 underline-offset-4 hover:text-neutral-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--focus-ring-color)] dark:hover:text-neutral-100';

/** StableRoute community Discord invite (opens in a new tab). */
export const DISCORD_INVITE_URL = 'https://discord.gg/37aCpusvx';

/**
 * Site-wide footer rendered from the root layout.
 *
 * Preserves the StableRoute tagline, shows a copyright line with a
 * dynamically computed current year (never hard-coded), and exposes
 * primary navigation to `/docs`, `/about`, and the StableRoute Discord.
 * Remains a Server Component — the year is computed at render time.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-neutral-200 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800">
      <p>StableRoute — liquidity routing on Stellar.</p>
      <p className="mt-2">&copy; {year} StableRoute. All rights reserved.</p>
      <nav
        aria-label="Footer navigation"
        className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
      >
        <Link href="/docs" className={footerLinkClass}>
          Docs
        </Link>
        <Link href="/about" className={footerLinkClass}>
          About
        </Link>
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="StableRoute Discord (opens externally)"
          className={footerLinkClass}
        >
          Discord
        </a>
      </nav>
    </footer>
  );
}
