import { Link } from 'react-router-dom';

const PRODUCT_LINKS = [
  { to: '/capabilities', label: 'Capabilities' },
  { to: '/docs', label: 'Docs' },
  { to: '/playground', label: 'Playground' },
] as const;

const RESOURCE_LINKS = [
  { href: '/openapi.json', label: 'OpenAPI spec' },
  { href: '/llms.txt', label: 'llms.txt' },
  { href: '/agents.md', label: 'agents.md' },
  { href: 'https://facilitator.goplausible.xyz', label: 'GoPlausible facilitator' },
] as const;

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-inkline">
      <div className="mx-auto flex max-w-(--page-max-width) flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Link to="/" className="font-heading text-base font-medium text-quartz">
            Callrack
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-ash">
            Pay-per-use information infrastructure for software and AI agents. Call a capability, pay only when
            you use it, over x402 on Algorand.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-ash uppercase">Product</p>
            <ul className="mt-3 flex flex-col gap-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-mist hover:text-quartz">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-ash uppercase">Resources</p>
            <ul className="mt-3 flex flex-col gap-2">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-mist hover:text-quartz"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-inkline px-4 py-4 text-center text-xs text-slate sm:px-6">
        &copy; {new Date().getFullYear()} Callrack. Payments settle over x402 on Algorand.
      </div>
    </footer>
  );
}
