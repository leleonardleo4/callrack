import { useEffect } from 'react';

export interface SeoProps {
  readonly title: string;
  readonly description: string;
  readonly path: string;
}

const SITE_NAME = 'Callrack';
const SITE_ORIGIN = 'https://callrack.xyz';

function setMetaTag(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Sets per-route document metadata. This app is a client-rendered SPA (no
 * Next.js, no SSR/prerendering per Phase 9 scope), so this only benefits
 * real browser navigation and crawlers that execute JavaScript (Googlebot
 * does); a scraper that only reads the initial HTML sees the static
 * defaults already in `index.html`. That's an honest limitation, not
 * something to paper over.
 */
export function Seo({ title, description, path }: SeoProps): null {
  useEffect(() => {
    const fullTitle = `${title} - ${SITE_NAME}`;
    document.title = fullTitle;
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', `${SITE_ORIGIN}${path}`);
    setCanonical(`${SITE_ORIGIN}${path}`);
  }, [title, description, path]);

  return null;
}
